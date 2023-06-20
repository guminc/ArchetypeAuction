import { assert, expect } from 'chai';
import { 
    cartesian,
    getContractBalance,
    getRandomFundedAccount,
    mkMinBid,
    parallelAutoAuction,
    range,
    sleep,
    toWei 
} from '../scripts/helpers';
import * as A from 'fp-ts/Array'
import * as N from 'fp-ts/number'
import { ethers } from 'hardhat';
import { LineStateStruct } from '../typechain-types/contracts/ParallelAutoAuction';
import { BigNumber, ContractTransaction } from 'ethers';

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
        const auctionDuration = 2
        const startingPrice = 0.1
        const bidIncrement = 0.05

        const { auction } = await parallelAutoAuction({
            auctionsAtSameTime: expectedIdsLen, 
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            bidIncrement
        })

        const bidder = await getRandomFundedAccount()

        await auction.connect(bidder).createBid(2, { value: toWei(startingPrice) })
        await sleep(auctionDuration)
        await expect(auction.connect(bidder).createBid(
            2, { value: toWei(startingPrice).add(toWei(bidIncrement)) }
        )).reverted
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
        await expect(bid(2)()).reverted
        bid(2 + expectedIdsLen)
    })

    it.skip('should allow ids initialization', async () => {
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

        const lineHeadIs = (n: number) => (line: LineStateStruct) => line.head === n
        console.log(await getLines()) 
        expect(A.every(lineHeadIs(0))(await getLines())).true
        await mkMinBid(auction)(bidder)(idToBid)() // Autism.
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
    
    it('should allow refunds on outbids', async () => {
        const startingPrice = 0.1 
        const bidIncrement = 0.05

        const { auction } = await parallelAutoAuction({
            startingPrice, bidIncrement
        })
        
        const user = await getRandomFundedAccount()
        const outBidder = await getRandomFundedAccount()
        const iniBal = await user.getBalance()
        
        await auction.connect(user).createBid(1, {
            value: toWei(startingPrice) 
        })
        await auction.connect(outBidder).createBid(1, {
            value: toWei(startingPrice).add(toWei(bidIncrement)) 
        })

        const newBal = await user.getBalance()
    
        expect(iniBal).approximately(newBal, toWei(0.005))
        
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

        await expect(
            auction.connect(user).createBid(1, { value: minPrice.sub(1) })
        ).reverted
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
    
    it('should allow right increment bids', async () => {
        const startingPrice = 0.1
        const bidIncrement = 0.05
        
        const { auction } = await parallelAutoAuction({
            startingPrice, bidIncrement
        })

        const bidder = await getRandomFundedAccount()

        const mkbid = (n: BigNumber) => auction
            .connect(bidder)
            .createBid(1, { value: n })

        await expect(mkbid(toWei(startingPrice).sub(1))).reverted
        await mkbid(toWei(startingPrice))
        
        await expect(mkbid(toWei(startingPrice).add(toWei(bidIncrement)).sub(1))).reverted
        await mkbid(toWei(startingPrice).add(toWei(bidIncrement)))

        await expect(mkbid(toWei(bidIncrement).mul(2).add(toWei(startingPrice)).sub(1))).reverted
        await mkbid(toWei(bidIncrement).mul(2).add(toWei(startingPrice)))
        
    })

    it('should use right min price over different ids', async () => {
        const startingPrice = 0.1
        const bidIncrement = 0.05
        const auctionsAtSameTime = 10
        
        const { auction } = await parallelAutoAuction({
            auctionsAtSameTime,
            auctionDuration: 10, 
            extraAuctionTime: 0,
            startingPrice,
            bidIncrement
        })

        const bidder = await getRandomFundedAccount()
        const bidder1 = await getRandomFundedAccount()
        
        await auction.connect(bidder).createBid(3, { value: toWei(startingPrice) })

        await expect(auction
            .connect(bidder)
            .createBid(3, { value: toWei(startingPrice).add(toWei(bidIncrement)).sub(1) })
        ).reverted

        await auction
            .connect(bidder1)
            .createBid(3, { value: toWei(startingPrice).add(toWei(bidIncrement)) })
        
        await expect(auction
            .connect(bidder)
            .createBid(1, { value: toWei(startingPrice).sub(1) })
        ).reverted

        await auction
            .connect(bidder1)
            .createBid(1, { value: toWei(startingPrice) })
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
    
    it('should allow secure settling', async () => {
        const auctionDuration = 3 // 3 secs
        const startingPrice = 0.1
        const bidIncrement = 0.05

        const { auction, nft } = await parallelAutoAuction({
            auctionsAtSameTime: 10,
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            bidIncrement
        })

        const bidder = await getRandomFundedAccount() 
        const anyone = await getRandomFundedAccount()
        const bidder1 = await getRandomFundedAccount() 
        
        await auction.connect(bidder).createBid(2, { value: toWei(startingPrice) })
        await sleep(auctionDuration)
        await auction.connect(anyone).settleAuction(2)

        await expect(auction
            .connect(bidder1)
            .createBid(2, { value: toWei(startingPrice*10) })
        ).reverted

        expect(await nft.balanceOf(bidder.address)).equal(1)
        expect(await nft.balanceOf(auction.address)).equal(0)
        expect(await getContractBalance(auction)).equal(0)
        expect(await getContractBalance(nft)).equal(toWei(startingPrice))
    
        const newBidAmount = toWei(startingPrice).add(123)

        await expect(auction
            .connect(bidder1)
            .createBid(12, { value: toWei(startingPrice).sub(1) })
        ).reverted

        await auction.connect(bidder1).createBid(12, { value: newBidAmount })

        expect(await nft.balanceOf(bidder.address)).equal(1)
        expect(await nft.balanceOf(auction.address)).equal(0)
        expect(await getContractBalance(auction)).equal(newBidAmount)
        expect(await getContractBalance(nft)).equal(toWei(startingPrice))
    })

    it('shouldn\'t allow zero bid increments', async () => {
        const startingPrice = 0.01
        const bidIncrement = 0

        await expect(parallelAutoAuction({
            auctionsAtSameTime: 1, startingPrice, bidIncrement
        })).reverted
    })

    it('should allow bid incrementing on free bids', async () => {
        const startingPrice = 0
        const bidIncrement = 0.01

        const { auction, nft, user } = await parallelAutoAuction({
            auctionsAtSameTime: 1, startingPrice, bidIncrement,
            extraAuctionTime: 5
        })
        
        const mkbid = (n: BigNumber) => auction.connect(user).createBid(1, { value: n })

        await mkbid(toWei(0))
        await expect(mkbid(toWei(0))).reverted

        const rangedBids = async (n: BigNumber) => {
            await expect(mkbid(n.sub(1))).reverted
            await mkbid(n)
            await expect(mkbid(n)).reverted
            await expect(mkbid(n.add(1))).reverted
        }

        await rangedBids(toWei(bidIncrement))
        await rangedBids(toWei(bidIncrement).mul(2))
        await rangedBids(toWei(bidIncrement).mul(3))
    })
    
    const rangedBidsBuilder = (
        biddingFunction: (n: BigNumber) => Promise<ContractTransaction>
    ) => async (n: BigNumber) => {
        await expect(biddingFunction(n.sub(1))).reverted
        await biddingFunction(n)
        await expect(biddingFunction(n)).reverted
        await expect(biddingFunction(n.add(1))).reverted
    }

    it('should allow bid incrementing normal bid', async () => {
        const startingPrices = [0.01, 0.1, 0.005, 0.0005]
        const bidIncrements = [0.0099, 0.005, 0.01001, 0.02, 0.0005]
        
        const prod = cartesian(startingPrices, bidIncrements)

        for (const [startingPrice, bidIncrement] of prod) {
            const { auction, user } = await parallelAutoAuction({
                auctionsAtSameTime: 1, startingPrice, bidIncrement,
                extraAuctionTime: 5
            })
            
            const mkbid = (n: BigNumber) => auction.connect(user).createBid(1, { value: n })
            const rangedBids = rangedBidsBuilder(mkbid) 

            await expect(mkbid(toWei(0))).reverted
            await expect(mkbid(toWei(startingPrice).sub(1))).reverted
            await mkbid(toWei(startingPrice))

            await rangedBids(toWei(startingPrice).add(toWei(bidIncrement)))
            await rangedBids(toWei(bidIncrement).mul(2).add(toWei(startingPrice)))
            await rangedBids(toWei(bidIncrement).mul(3).add(toWei(startingPrice)))

        }

    })

    it('should allow bid incrementing normal bid with fuzzing', async () => {
        const startingPrices = [0.01, 0.1, 0.005, 0.0005]
        const bidIncrements = [0.0099, 0.005, 0.01001, 0.02, 0.0005]
        
        const prod = cartesian(startingPrices, bidIncrements)

        for (const [startingPrice, bidIncrement] of prod) {

            const { auction, user } = await parallelAutoAuction({
                auctionsAtSameTime: 1,
                startingPrice,
                bidIncrement,
                auctionDuration: 100,
                extraAuctionTime: 5
            })

            const hacker = await getRandomFundedAccount()
            const iniHackerBal = await hacker.getBalance()
            const iniBal = await user.getBalance()

            const fuzzer = async () => { try {
                const bid = auction.connect(hacker).createBid(
                    1, { value: (await auction.getMinPriceFor(1)).sub(1) }
                )
                await bid
                await auction.connect(hacker).settleAuction(0)
                await bid
                await auction.connect(hacker).settleAuction(1)
                await bid
                await auction.connect(hacker).settleAuction(2)
                await bid
            } catch {}}
            
            const mkbid = (n: BigNumber) => auction.connect(user).createBid(1, { value: n })
            const rangedBids = rangedBidsBuilder(mkbid) 
            
            await expect(mkbid(toWei(0))).reverted
            await expect(mkbid(toWei(startingPrice).sub(1))).reverted
            await fuzzer()

            await mkbid(toWei(startingPrice))
            await fuzzer()

            await rangedBids(toWei(startingPrice).add(toWei(bidIncrement)))
            await fuzzer()
            
            await rangedBids(toWei(bidIncrement).mul(2).add(toWei(startingPrice)))
            await fuzzer()

            const lastBid = toWei(bidIncrement).mul(3).add(toWei(startingPrice))
            await rangedBids(lastBid)
            await fuzzer()

            expect(await hacker.getBalance()).lessThan(iniHackerBal)
            const line = await auction.lineState(1)
            expect(line.currentWinner).equal(user.address)
            expect(line.currentPrice).equal(lastBid)
            expect(await getContractBalance(auction)).equal(lastBid)
            expect(await user.getBalance()).approximately(
                iniBal.sub(lastBid), toWei(0.001)
            );
        }

    })

    it('shouldn\'t be able to settle nothing', async () => {
        const { auction } = await parallelAutoAuction({ })
        const hacker = await getRandomFundedAccount()
        await expect(auction.connect(hacker).settleAuction(1)).reverted
    })

});

