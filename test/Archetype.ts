import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';

import { 
    MinimalAuctionableNFT,
    MinimalAuctionableNFT__factory,
    ScatterAuction,
    ScatterAuction__factory 
} from '../typechain-types';
import { BigNumber } from 'ethers';

// Helpers, TODO, should get decoupled


const toWei = (x: number) => ethers.utils.parseUnits(x.toString(), 'ether')

const fromParamToAuctionIndex: any = {
    "bidder": 0,
    "amount": 1,
    "startTime": 2,
    "endTime": 3,
    "nftId": 4,
    "maxSupply": 5,
    "settled": 6,
    "nftContract": 7,
    "reservePrice": 8,
    "bidIncrement": 9,
    "duration": 10,
    "timeBuffer": 11,
    "nftContractBalance": 12,
    "rewardToken": 13
}

const getparam = async (param: string, auction: ScatterAuction) => {
    const data = await auction.auctionData()
    if (param in data) return data[fromParamToAuctionIndex[param]]
    else return 'NONE'
};

const getNextPrice = async (auction: ScatterAuction) => {
    const lastPrice = await getparam('amount', auction) as BigNumber
    const increment = await getparam('bidIncrement', auction) as BigNumber
    return lastPrice.add(increment)
};

const auctionFactory = async ({
    maxSupply = 1000,
    reservePrice = 0.1,
    bidIncrement = 0.05,
    auctionDuration = 3 * 60 * 60, // 3 hours
    extraBidTime = 5 * 60, // 5 mins
    auctionType = 'ScatterAuction'
}) => {
    const AuctionFactory = await ethers.getContractFactory(auctionType);
    const NftFactory = await ethers.getContractFactory('MinimalAuctionableNFT')
    
    const nft: MinimalAuctionableNFT = await NftFactory.deploy("TestNft", "TEST")
    const auction: ScatterAuction = await AuctionFactory.deploy() as ScatterAuction
    
    await nft.deployed()
    await auction.deployed()

    await auction.initialize(
        nft.address,
        maxSupply,
        toWei(reservePrice),
        toWei(bidIncrement),
        auctionDuration,
        extraBidTime
    );

    await nft.setMinter(auction.address)

    return { auction, nft }
}

describe('ScatterAuction', () => {

    let ScatterAuction: ScatterAuction__factory;
    let NftFactory: MinimalAuctionableNFT__factory;
    let scatterAuction: ScatterAuction;
    let minimalNft: MinimalAuctionableNFT;

    before(async () => {
        const { auction, nft } = await auctionFactory({})
        scatterAuction = auction
        minimalNft = nft
    })

    it('should have parameters correctly initialized', async () => {
        const { auction, nft } = await auctionFactory({maxSupply: 420})
        const totalSupply = await getparam('maxSupply', auction)
        expect(totalSupply).to.equal(420)

        const nftAddress = await getparam('nftContract', auction)
        expect(nftAddress).to.equal(nft.address)

    })

    it('shouldn\'t allow bidding on non initialized ids', async () => {
        const { auction, nft } = await auctionFactory({reservePrice: 0.01, bidIncrement: 0.01})
        const maxSupply = await getparam('maxSupply', auction) as number
        const idsToTest = [0, 1, 2, maxSupply , 1231231231, 1]
        const shouldAllowBidding = idsToTest.map(id => id == 1)
        
        const [_, bidder] = await ethers.getSigners();

        const mkbid = (i: number) => 
            auction.connect(bidder).createBid(i, {value: getNextPrice(auction)})

        for (let i = 0; i < idsToTest.length; i++)
            if (shouldAllowBidding[i]) await mkbid(idsToTest[i])
            else await expect(mkbid(idsToTest[i])).to.be.reverted
    })

})
