import { ethers } from 'hardhat';

import { 
    ScatterAuction,
} from '../typechain-types';
import { BigNumber, Contract } from 'ethers';

export const id = (x: any): any => x
export const randrange = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

export const toWei = (x: number) => ethers.utils.parseUnits(x.toString(), 'ether')
export const fromWei = (x: BigNumber) => ethers.utils.formatEther(x)
export const sleep = (s: number) => new Promise(resolve => setTimeout(resolve, s*1000)); 

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

export const getparam = async (param: string, auction: ScatterAuction) => {
    const data = await auction.auctionData()
    if (param in data) return data[fromParamToAuctionIndex[param]]
    else return 'NONE'
};

export const getNextPrice = async (auction: ScatterAuction) => {
    const lastPrice = await getparam('amount', auction) as BigNumber
        
    const increment = lastPrice.eq(0) ? 
        await getparam('reservePrice', auction) as BigNumber: 
        await getparam('bidIncrement', auction) as BigNumber

    return lastPrice.add(increment)
};

export const getNextId = async (auction: ScatterAuction): Promise<number> => {
    const n = await getparam('nftId', auction) as number
    if (n === 0 || await getparam('settled', auction))
        return n + 1
    return n
};

export const getLastTimestamp = async () =>
    (await ethers.provider.getBlock('latest')).timestamp

export const getContractBalance = async (contract: Contract): Promise<BigNumber> =>
    await ethers.provider.getBalance(contract.address)

export const auctionFactory = async ({
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
