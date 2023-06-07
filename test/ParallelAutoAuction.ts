import { assert, expect } from 'chai';
import { LineState, fromWei, getContractBalance, getLastTimestamp, getRandomFundedAccount, mkBid, mkMinBid, parallelAutoAuction, range, sleep, sum, sumBigNumbers, toWei } from '../scripts/helpers';
import * as A from 'fp-ts/Array'
import * as N from 'fp-ts/number'
import { ethers } from 'hardhat';

describe('ParallelAutoAuction', async () => {
    it('should show right initial ids', async () => {
        const expectedIdsLen = 32
        const expectedIds = range(1, expectedIdsLen)

        const { auction } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen
        })
            
        const idsGot = await auction.getIdsToAuction()
        const areEqual = A.getEq(N.Eq).equals(idsGot, expectedIds)
        assert(areEqual)
    })
    
    it('should be able to configure minter', async () => {
        const { auction, nft } = await parallelAutoAuction({})
        expect(await nft.isMinter(auction.address)).true
    })
    
    it('shouln\'t allow bidding on old ids', async () => {
        const expectedIdsLen = 3

        const { auction } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen, 
            auctionDuration: 2, 
            extraAuctionTime: 0,
        })

        const bidder = await getRandomFundedAccount()

        const bid = mkMinBid(auction)(bidder)(2)

        await bid()
        await sleep(2)
        expect(bid).to.revertedWith('WrongTokenId')
    })

    it('should allow bidding on new ids', async () => {
        const expectedIdsLen = 3

        const { auction } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen, 
            auctionDuration: 2, 
            extraAuctionTime: 0,
        })

        const bidder = await getRandomFundedAccount()

        const bid = mkMinBid(auction)(bidder)

        await bid(2)()
        await sleep(2)
        expect(bid(2)).to.revertedWith('WrongTokenId')
        bid(2 + expectedIdsLen)
    })

    it('should allow ids initialization', async () => {
        const expectedIdsLen = 3
        const ids = range(1, expectedIdsLen)
        const idToBid = 2

        const { auction } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen, 
            auctionDuration: 2, 
            extraAuctionTime: 0,
        })

        const bidder = await getRandomFundedAccount()
        
        const getLine = async (id: number) => await auction.lineState(id)
        const getLines = async () => await Promise.all(ids.map(getLine))

        const lineHeadIs = (n: number) => (line: LineState) => line.head === n
        
        expect(A.every(lineHeadIs(0))(await getLines())).true
        await mkMinBid(auction)(bidder)(idToBid)()
        expect(A.every(lineHeadIs(0))(await getLines())).false

        expect((await getLine(1)).head).to.equals(0)
        expect((await getLine(2)).head).to.equals(2)
        expect((await getLine(3)).head).to.equals(0)
    })

    it('should allow winning auction', async () => {
        const expectedIdsLen = 3
        const idToBid = 2

        const { auction, nft, user } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen, 
            auctionDuration: 1, 
            extraAuctionTime: 0,
        })

        const bid = mkMinBid(auction)(user)
        await bid(idToBid)()
        await sleep(1)
        await bid(idToBid + expectedIdsLen)()

        expect(await nft.balanceOf(user.address)).to.equals(1)
    })

    it('should store winner balance securely', async () => {
        const expectedIdsLen = 3
        const idToBid = 2

        const { auction, nft, user } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen, 
            auctionDuration: 1, 
            extraAuctionTime: 0,
        })
        
        const bid = mkMinBid(auction)(user)
        const minPrice = await auction.getMinPriceFor(idToBid)
        await bid(idToBid)()
        await sleep(2)
        await bid(idToBid + expectedIdsLen)()

        expect(await getContractBalance(auction)).to.equals(minPrice)
        expect(await getContractBalance(nft)).to.equals(minPrice)
    })

    it('shouldn\'t allow bid below min price', async () => {
        const { auction, user } = await parallelAutoAuction({
            auctionDuration: 1, 
            extraAuctionTime: 0,
            startingPrice: 0.1
        })
        
        const minPrice = await auction.getMinPriceFor(1)

        expect(
            auction.connect(user).createBid(1, { value: minPrice.sub(1) })
        ).to.revertedWith('WrongBidAmount')
        await auction.connect(user).createBid(1, { value: minPrice })
    })

    it('should show right ids', async () => {
        const expectedIdsLen = 4
        const expectedIds = [1,2,7,4]

        const { auction } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen, 
            auctionDuration: 2, 
            extraAuctionTime: 0,
        })

        const bidder = await getRandomFundedAccount()

        await auction.connect(bidder).createBid(
            3, { value: await auction.getMinPriceFor(3) }
        )
        
        await sleep(3)

        const idsGot = await auction.getIdsToAuction()
        const areEqual = A.getEq(N.Eq).equals(idsGot, expectedIds)

        assert(areEqual)
    })

    it('should show right min price', async () => {
        const iniPrice = 0.1
        const bidIncrement = 0.05
        const epsilon = 0.0196

        const { auction, user } = await parallelAutoAuction({
            startingPrice: iniPrice, bidIncrement
        })

        expect(await auction.getMinPriceFor(1)).equals(toWei(iniPrice))


        await auction.connect(user).createBid(
            1, { value: toWei(iniPrice).add(toWei(epsilon)) }
        )

        expect(await auction.getMinPriceFor(1)).equals(
            toWei(iniPrice).add(toWei(bidIncrement)).add(toWei(epsilon))
        )
    })

    it('should trigger next auction when calling settleAuction', async () => {
        const expectedIdsLen = 2
        const idToBid = 2

        const { auction, nft, user } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen,
            auctionDuration: 1,
            extraAuctionTime: 0,
        })

        const bid = mkMinBid(auction)(user)
        await bid(idToBid)()
        await sleep(2)
        await auction.settleAuction(idToBid)

        expect(await nft.balanceOf(user.address)).to.equals(1)
        expect(await auction.getMinPriceFor(4)).to.equals(toWei(0.1)) // starting price - auction for 4 should have started
    })

    it('should use right min price over different ids', async () => {
        expect(1).equals(2)
        // TODO
    })


    it('reentrancy test', async () => {
        const { auction } = await parallelAutoAuction({
            auctionDuration: 10, 
            extraAuctionTime: 0,
            startingPrice: 1,
            bidIncrement: 0.1
        })

        const reentrancyFactory = await ethers.getContractFactory('Reentrancy')
        const reentrancy = await reentrancyFactory.deploy(auction.address)

        const bidder = await getRandomFundedAccount()
        const hacker = await getRandomFundedAccount()
        
        const iniBal = await hacker.getBalance()
        const legitIniBal = await bidder.getBalance()
        
        await reentrancy.connect(hacker).hack(1, { value: toWei(1) })
        const iniContractBal = await getContractBalance(auction)
        const expectedPrice = toWei(1.1)
        await auction.connect(bidder).createBid(1, { value: expectedPrice })

        const finBal = await hacker.getBalance()
        const legitFinBal = await bidder.getBalance()

        const line = await auction.lineState(1)
        const finalContractBal = await getContractBalance(auction)
        
        expect(finBal).to.lessThan(iniBal)
        expect(legitFinBal).to.lessThan(legitIniBal)
        expect(line.currentWinner).to.equals(bidder.address)
        expect(line.currentPrice).to.equals(expectedPrice)
        expect(finalContractBal).greaterThan(iniContractBal)
        expect(finalContractBal).equals(expectedPrice)
    })

    it('should allow minting out', async () => {
        expect(1).equals(2)
        // TODO
    })

});

