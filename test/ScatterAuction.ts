import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';

import { 
    MinimalAuctionableNFT,
    MinimalAuctionableNFT__factory,
    ScatterAuction,
    ScatterAuction__factory 
} from '../typechain-types';
import { BigNumber, Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// Helpers, TODO, should get decoupled

const id = (x: any): any => x
const randrange = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const toWei = (x: number) => ethers.utils.parseUnits(x.toString(), 'ether')
const fromWei = (x: BigNumber) => ethers.utils.formatEther(x)
const sleep = (s: number) => new Promise(resolve => setTimeout(resolve, s*1000)); 

const fromParamToAuctionIndex: any = {
    "bidder": 0,
    "bidToken": 1,
    "amount": 2,
    "isEthAuction": 3,
    "startTime": 4,
    "endTime": 5,
    "nftId": 6,
    "maxSupply": 7,
    "settled": 8,
    "nftContract": 9,
    "reservePrice": 10,
    "bidIncrement": 11,
    "duration": 12,
    "timeBuffer": 13,
    "nftContractBalance": 14
}

const getparam = async (param: string, auction: ScatterAuction) => {
    const data = await auction.auctionData()
    if (param in data) return data[fromParamToAuctionIndex[param]]
    else return 'NONE'
};

const getNextPrice = async (auction: ScatterAuction) => {
    const lastPrice = await getparam('amount', auction) as BigNumber
        
    const increment = lastPrice.eq(0) ? 
        await getparam('reservePrice', auction) as BigNumber: 
        await getparam('bidIncrement', auction) as BigNumber

    return lastPrice.add(increment)
};

const getNextId = async (auction: ScatterAuction): Promise<number> => {
    const n = await getparam('nftId', auction) as number
    if (n === 0 || await getparam('settled', auction))
        return n + 1
    return n
};

const getLastTimestamp = async () =>
    (await ethers.provider.getBlock('latest')).timestamp

const getContractBalance = async (contract: Contract): Promise<BigNumber> =>
    await ethers.provider.getBalance(contract.address)

const auctionFactory = async ({
    maxSupply = 1000,
    reservePrice = 0.1,
    bidIncrement = 0.05,
    auctionDuration = 3 * 60 * 60, // 3 hours
    extraBidTime = 5 * 60, // 5 mins
    auctionType = 'ScatterAuction',
    useBidToken = false,
}) => {
    const AuctionFactory = await ethers.getContractFactory(auctionType);
    const NftFactory = await ethers.getContractFactory('MinimalAuctionableNFT')
    const TestErc20Factory = await ethers.getContractFactory('TestToken')

    const [deployer, ] = await ethers.getSigners()
    
    const nft = await NftFactory.deploy('TestNft', 'TEST')
    const auction = await AuctionFactory.deploy() as ScatterAuction
    const bidToken = await TestErc20Factory.connect(deployer).deploy()
    
    await nft.deployed()
    await auction.deployed()
    
    await auction.initialize(
        useBidToken ? bidToken.address : ethers.constants.AddressZero,
        nft.address,
        maxSupply,
        toWei(reservePrice),
        toWei(bidIncrement),
        auctionDuration,
        extraBidTime
    );

    await nft.setMinter(auction.address)

    return { auction, nft, bidToken }
}

describe('ScatterAuction', () => {

    it('should have parameters correctly initialized', async () => {
        const { auction, nft } = await auctionFactory({maxSupply: 420})
        const maxSupp = await getparam('maxSupply', auction)
        expect(maxSupp).to.equal(420)

        const nftAddress = await getparam('nftContract', auction)
        expect(nftAddress).to.equal(nft.address)
        expect(await getparam('isEthAuction', auction)).true
        expect(await getparam('bidToken', auction)).to.equal(ethers.constants.AddressZero)

    })
    
    it('should allow bidding on valid ids', async () => {
        const { auction } = await auctionFactory({reservePrice: 0.01, bidIncrement: 0.01})
        const [_, bidder] = await ethers.getSigners();

        const mkbid = (i: number) => 
            auction.connect(bidder).createBid(i, 0, {value: getNextPrice(auction)})
        
        for (let i = 0; i < 5; i++)
            await mkbid(1)
    })

    it('shouldn\'t allow bidding on non initialized ids', async () => {
        const { auction } = await auctionFactory({reservePrice: 0.01, bidIncrement: 0.01})
        const maxSupply = await getparam('maxSupply', auction) as number
        const idsToTest = [0, 1, 2, maxSupply , 1231231231, 1]
        const shouldAllowBidding = idsToTest.map(id => id == 1)
        
        const [_, bidder] = await ethers.getSigners();

        const mkbid = (i: number) => 
            auction.connect(bidder).createBid(i, 0, {value: getNextPrice(auction)})

        for (let i = 0; i < idsToTest.length; i++)
            if (shouldAllowBidding[i]) await mkbid(idsToTest[i])
            else await expect(mkbid(idsToTest[i])).to.be.reverted
    })

    it('should allow bids with ERC20 tokens', async () => {
        const { auction, nft, bidToken } = await auctionFactory({
            reservePrice: 10, bidIncrement: 5, useBidToken: true, 
            auctionDuration: 5, extraBidTime: 0
        })
        const [owner, bidder1, bidder2] = await ethers.getSigners()
        bidToken.connect(owner).transfer(bidder1.address, toWei(50))
        bidToken.connect(owner).transfer(bidder2.address, toWei(50))

        expect(auction.connect(bidder1).createBid(1, toWei(10))).to.be.reverted

        await bidToken.connect(bidder1).approve(auction.address, toWei(50))
        await bidToken.connect(bidder2).approve(auction.address, toWei(50))

        await auction.connect(bidder1).createBid(1, toWei(10))
        expect(auction.connect(bidder2).createBid(1, toWei(14.9))).to.be.reverted
        await auction.connect(bidder2).createBid(1, toWei(15))

        await sleep(5)

        await auction.connect(bidder1).createBid(2, toWei(20))
        
        expect(await bidToken.balanceOf(auction.address)).to.equal(toWei(20))
        expect(await bidToken.balanceOf(nft.address)).to.equal(toWei(15))
        expect(await bidToken.balanceOf(bidder1.address)).to.equal(toWei(50 - 20))
        expect(await bidToken.balanceOf(bidder2.address)).to.equal(toWei(50 - 15))
    
        expect(await getContractBalance(bidToken)).to.equal(0)
        expect(await getContractBalance(auction)).to.equal(0)
        expect(await getContractBalance(nft)).to.equal(0)
    })

    it('should be able to withdraw eth', async () => {
        const { auction, nft } = await auctionFactory({
            reservePrice: 0.01, bidIncrement: 0.01, auctionDuration: 3, extraBidTime: 0
        })

        const [owner, bidder] = await ethers.getSigners()

        await auction.connect(bidder).createBid(1, 0, {value: toWei(0.01)})
        await sleep(3)
        await auction.settleAuction()
        
        const iniBal = await owner.getBalance()
        await nft.connect(owner)['withdraw()']()
        expect(await owner.getBalance()).to.be.approximately(
            iniBal.add(toWei(0.01)), toWei(0.0001)
        )
    })

    it('should be able to withdraw erc20', async () => {
        const { auction, nft, bidToken } = await auctionFactory({
            reservePrice: 10, auctionDuration: 3, extraBidTime: 0, useBidToken: true
        })

        const [owner, bidder] = await ethers.getSigners()
        bidToken.connect(owner).transfer(bidder.address, toWei(50))

        await bidToken.connect(bidder).approve(auction.address, toWei(10))
        await auction.connect(bidder).createBid(1, toWei(10))

        await sleep(3)
        await auction.settleAuction()
        
        const iniBal = await owner.getBalance()
        const iniTokensBal = await bidToken.balanceOf(owner.address)
        
        expect(await getContractBalance(nft)).to.equal(0)
        expect(await getContractBalance(auction)).to.equal(0)

        await nft.connect(owner)['withdraw(address)'](bidToken.address)
        await nft.connect(owner)['withdraw()']()

        expect(await owner.getBalance()).to.approximately(iniBal, toWei(0.001))
        expect(await bidToken.balanceOf(owner.address)).to.equal(iniTokensBal.add(toWei(10)))
    })

    // Epic smoke test.
    it('should allow functional bidding and mint out', async () => {
        const { auction, nft } = await auctionFactory({
            reservePrice: 0.01,
            bidIncrement: 0.005,
            auctionDuration: 5,
            extraBidTime: 3,
            maxSupply: 5
        })

        const [_, bidder1, bidder2, bidder3] = await ethers.getSigners()
    
        const mkbid = (bidder: SignerWithAddress, i: number, eth: number) =>
            auction.connect(bidder).createBid(i, 0, {value: toWei(eth)})
        
        await mkbid(bidder1, 1, 0.01)
        await mkbid(bidder2, 1, 0.015)
        await mkbid(bidder1, 1, 0.03)

        expect(await getNextPrice(auction)).to.equal(toWei(0.035))

        expect(mkbid(bidder3, 0, 1)).to.be.reverted
        expect(mkbid(bidder3, 2, 1)).to.be.reverted
        expect(mkbid(bidder3, 5, 1)).to.be.reverted
        expect(mkbid(bidder3, 6, 1)).to.be.reverted
        
        // Bid should have finished at this point.
        expect(mkbid(bidder3, 1, 0.035)).to.be.reverted

        expect(mkbid(bidder2, 1, 1)).to.be.reverted
        
        // Even if `auctionDuration` was exceded, `bidder2` should be able
        // to keep bidding because of `extraBidTime`.
        for (let i = 0.1; i < 0.15; i += 0.005) {
            await mkbid(bidder2, 2, i)
            await sleep(1)
        }
        
        await sleep(2)
        
        expect(await nft.balanceOf(bidder2.address)).to.equal(0)
        await auction.settleAuction()
        expect(await nft.balanceOf(bidder2.address)).to.equal(1)
        
        const iniBal = await bidder3.getBalance()

        await mkbid(bidder3, 3, 0.02)
        await sleep(5)
        await mkbid(bidder2, 4, 0.01)
        
        const expectedVal = iniBal.sub(toWei(0.02))

        expect(await nft.balanceOf(bidder3.address)).to.equal(1)
        expect(await bidder3.getBalance()).to.be.approximately(
            expectedVal, toWei(0.005)
        )

        await sleep(5)
        await mkbid(bidder2, 5, 0.01)
        await sleep(5)

        const iniBal2 = await bidder3.getBalance()
        const iniNfts = await nft.balanceOf(bidder3.address)

        // The tx should get processed, but no new nft should get
        // minted and the eth shoudl get returned.
        await mkbid(bidder3, 6, 0.01)
        expect(await nft.balanceOf(auction.address)).to.equal(0)
        await sleep(5)

        expect(iniBal2).to.be.approximately(await bidder3.getBalance(), toWei(0.005))
        expect(iniNfts).to.equal(await nft.balanceOf(bidder3.address))

    })
})
