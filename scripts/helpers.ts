import { ethers } from 'hardhat';

import { AutoAuction, } from '../typechain-types';
import { BigNumber, Contract, ContractTransaction } from 'ethers';

import { ParallelAutoAuction } from '../typechain-types/contracts/ParallelAutoAuction'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray'

/* -- Utility pure functions -- */
// TODO note that some of those functions are dupes of 
// scatter-art/ArchetypeERC20/scripts/helpers.ts, so they
// should get decoupled to an unique module.
export const randomAddress = () => `0x${[...Array(40)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('')}`;

export const getRandomAccount = async () => 
    await ethers.getImpersonatedSigner(randomAddress())

export const getRandomFundedAccount = async (funds: number = 10) => {
    const acc = await getRandomAccount() 
    const [admin, ] = await ethers.getSigners()
    await admin.sendTransaction({to: acc.address, value: toWei(funds)})
    return acc
};

export const id = (x: any): any => x
export const randrange = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

export const toWei = (x: number) => ethers.utils.parseUnits(x.toString(), 'ether')
export const fromWei = (x: BigNumber) => ethers.utils.formatEther(x)
export const sleep = (s: number) => new Promise(resolve => setTimeout(resolve, s*1000)); 


type MkBid = 
    (auction: ParallelAutoAuction) => 
    (bidder: SignerWithAddress) => 
    (id: number) =>
    (bid: BigNumber) => 
    () => Promise<ContractTransaction>

export const mkBid: MkBid = auction => bidder => id => bid =>
    async () => await auction.connect(bidder).createBid(
        id, { value: bid }
    )

type MkMinbid = 
    (auction: ParallelAutoAuction) => 
    (bidder: SignerWithAddress) => 
    (id: number) =>
    () => Promise<ContractTransaction>

export const mkMinBid: MkMinbid = auction => bidder => id  =>
    async () => await mkBid(auction)(bidder)(id)(
        await auction.getMinPriceFor(id)
    )()


export const range = (a: number, b: number): number[] => [...RNEA.range(a, b)]


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

export const getparam = async (param: string, auction: AutoAuction) => {
    const data = await auction.auctionData()
    if (param in data) return data[fromParamToAuctionIndex[param]]
    else return 'NONE'
};

export const getNextPrice = async (auction: AutoAuction) => {
    const lastPrice = await getparam('amount', auction) as BigNumber
        
    const increment = lastPrice.eq(0) ? 
        await getparam('reservePrice', auction) as BigNumber: 
        await getparam('bidIncrement', auction) as BigNumber

    return lastPrice.add(increment)
};

export const getNextId = async (auction: AutoAuction): Promise<number> => {
    const n = await getparam('nftId', auction) as number
    if (n === 0 || await getparam('settled', auction))
        return n + 1
    return n
};

export const getLastTimestamp = async () =>
    (await ethers.provider.getBlock('latest')).timestamp

/**
 * @returns The ETH balance in `contract`.
 */
export const getContractBalance = async (contract: Contract): Promise<BigNumber> =>
    await ethers.provider.getBalance(contract.address)

export const auctionFactory = async ({
    maxSupply = 1000,
    reservePrice = 0.1,
    bidIncrement = 0.05,
    auctionDuration = 3 * 60 * 60, // 3 hours
    extraBidTime = 5 * 60, // 5 mins
    auctionType = 'AutoAuction',
    useBidToken = false,
}) => {
    const AuctionFactory = await ethers.getContractFactory(auctionType);
    const NftFactory = await ethers.getContractFactory('MinimalAuctionableNFT')
    const TestErc20Factory = await ethers.getContractFactory('TestToken')

    const [deployer, ] = await ethers.getSigners()
    
    const nft = await NftFactory.deploy('TestNft', 'TEST', 100)
    const auction = await AuctionFactory.deploy() as AutoAuction
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

    await nft.addMinter(auction.address)

    return { auction, nft, bidToken }
}

export const parallelAutoAuction = async ({
    auctionsAtSameTime = 4,
    auctionDuration = 10, // 10 seconds
    extraAuctionTime = 3, // 3 seconds
    startingPrice = 0.1, // 0.1 eth
    bidIncrement = 0.05, // 0.05 eth
    mainnet = false,
    maxSupply = 100,
}) => {
    const AuctionFactory = await ethers.getContractFactory('RewardedParallelAuction');
    const NftFactory = await ethers.getContractFactory('MinimalAuctionableNFT')
    const [deployer, ] = await ethers.getSigners()
    
    const user = mainnet ? deployer : await getRandomFundedAccount()

    const nft = await NftFactory.connect(deployer).deploy(
        'TestNft', 'TEST', maxSupply
    )

    const auction = await AuctionFactory.connect(deployer).deploy()
    
    await auction.connect(deployer).initialize(
        nft.address,
        auctionsAtSameTime,
        auctionDuration,
        extraAuctionTime,
        toWei(startingPrice),
        toWei(bidIncrement)
    )
    
    await nft.connect(deployer).addMinter(auction.address)

    return {
        nft, auction, deployer, user
    }
}


