import { ethers } from "hardhat"
import { ConfigStruct } from "../typechain-types/contracts/tokens/PixeladyFigmata"
import { toWei } from "./helpers"

const preProdTestnetDeployment = async () => {

    const AuraAuctionFactory = await ethers.getContractFactory('AuraAuction')
    const AuraFactory = await ethers.getContractFactory('AuraGamma')
    // const NFTFactory = await ethers.getContractFactory('MinimalErc721')

    const [ deployer, ] = await ethers.getSigners()

    // We deploy fake ERC721 tokens to test VIP auctions with `FigmataAuction`.
    // const pixelady = await NFTFactory.deploy()
    // const pixeladyBc = await NFTFactory.deploy()
    // const milady = await NFTFactory.deploy()
    // const remilio = await NFTFactory.deploy()
    
    // Deployment to test wallet.
    // await milady.connect(deployer).mint(
    //     '0xDFA0B3fCf7B9E6e1BFB8ef536Aa33B5aF6Fd7F47', 13
    // )
        
    // Pixelady URI for testing.
    const baseUri = 'ipfs://bafybeicnhnsegllke6otkr5zh76whmwn4ms7kw6eaubpugzzjm5znbeyp4'
    // Who the fuck cares? The test uri should be for the tokens above! I guess?

    const conf: ConfigStruct = {
        baseUri,
        maxSupply: 88,
        platformFee: 500,
        ownerAltPayout: '0x6a6d59af77e75c5801bad3320729b81e888b5f09',
        altPlatformPayout: ethers.constants.AddressZero,
    }
    
    const aura = await AuraFactory.connect(deployer).deploy(
        'AURAGAMMA',
        'GAMMA',
        conf
    )

    const auction = await AuraAuctionFactory.connect(deployer).deploy()
    const auctionsAtSameTime = 10
    const auctionDuration = 24 * 60 * 60 // 1 day.
    const extraAuctionTime = 5 * 60 // 5 mins.
    const startingPrice = toWei(0)
    const bidIncrement = toWei(0.01)
    
    await auction.connect(deployer).initialize(
        aura.address,
        auctionsAtSameTime,
        auctionDuration,
        extraAuctionTime,
        startingPrice,
        bidIncrement
    )

    // await auction.connect(deployer).setTokensRequiredToHoldToBeVip([
    //     pixelady.address, pixeladyBc.address, milady.address, remilio.address
    // ])

    await aura.connect(deployer).addMinter(auction.address)

    // const vipIds = [ 
    //     1, 7, 51, 55, 171, 81, 114, 180, 230, 211, 210, 17, 179, 247, 288, 308, 36, 323
    // ]
    // await auction.connect(deployer).setVipIds(vipIds, true)
    
    console.log(`AuraGamma address: ${aura.address}`)
    console.log(`Auction address: ${auction.address}`)
}

const productionDeployment = async () => {

    const AuraAuctionFactory = await ethers.getContractFactory('AuraAuction')
    const AuraFactory = await ethers.getContractFactory('AuraGamma')

    const [ deployer, ] = await ethers.getSigners()

    const baseUri = 'ipfs://bafybeicnhnsegllke6otkr5zh76whmwn4ms7kw6eaubpugzzjm5znbeyp4/'

    const conf: ConfigStruct = {
        baseUri,
        maxSupply: 88,
        platformFee: 500,
        ownerAltPayout: '0x179677F33524358E3c146215054a4D27C644B7Fc',
        altPlatformPayout: ethers.constants.AddressZero,
    }

    console.log('Deploying AuraGAmma...')
    const aura = await AuraFactory.connect(deployer).deploy(
        'AURAGAMMA',
        'GAMMA',
        conf
    )

    const auction = await AuraAuctionFactory.connect(deployer).deploy()
    const auctionsAtSameTime = 8
    const auctionDuration = 24 * 60 * 60 // 1 day.
    const extraAuctionTime = 5 * 60 // 5 mins.
    const startingPrice = toWei(0)
    const bidIncrement = toWei(0.01)
    
    console.log('Initializing Auction...')
    await auction.connect(deployer).initialize(
        aura.address,
        auctionsAtSameTime,
        auctionDuration,
        extraAuctionTime,
        startingPrice,
        bidIncrement
    )

    console.log(`AuraGamma address: ${aura.address}`)
    console.log(`Auction address: ${auction.address}`)
    
    // NOTE This method should only get called instantly before production.
    // The whole front-end should already be integrated with the addresses
    // deployed before.
    // await figmata.connect(deployer).addMinter(auction.address)
}


const production = false

const deploymentFunction = production 
    ? productionDeployment
    : preProdTestnetDeployment

const msg = production
    ? 'Deploying into production...'
    : 'Deploying into pre-production...'

console.log(msg)
deploymentFunction()
    .then(() => console.log('Successful deployment :D'))
    .catch(e => console.log(`Something went wrong! ${e}`))

