import { ethers } from "hardhat"
import { ConfigStruct } from "../typechain-types/contracts/tokens/PixeladyFigmata"
import { toWei } from "./helpers"

const preProdTestnetDeployment = async () => {

    const FigmataAuctionFactory = await ethers.getContractFactory('FigmataAuction')
    const FigmataFactory = await ethers.getContractFactory('PixeladyFigmata')
    const NFTFactory = await ethers.getContractFactory('MinimalErc721')

    const [ deployer, ] = await ethers.getSigners()
    
    // We deploy fake ERC721 tokens to test VIP auctions with `FigmataAuction`.
    const pixelady = await NFTFactory.deploy()
    const pixeladyBc = await NFTFactory.deploy()
    const milady = await NFTFactory.deploy()
    const remilio = await NFTFactory.deploy()
    
    // Deployment to test wallet.
    await milady.connect(deployer).mint(
        '0xDFA0B3fCf7B9E6e1BFB8ef536Aa33B5aF6Fd7F47', 13
    )

    const conf: ConfigStruct = {
        baseUri: 'ipfs://fakeUri',
        maxSupply: 360,
        platformFee: 500,
        ownerAltPayout: '0x6a6d59af77e75c5801bad3320729b81e888b5f09',
        altPlatformPayout: ethers.constants.AddressZero,
    }
    
    const figmata = await FigmataFactory.connect(deployer).deploy(
        'Pixelady Figmata', // TODO
        'FIGMATA',
        conf
    )

    const auction = await FigmataAuctionFactory.connect(deployer).deploy()
    const auctionsAtSameTime = 10
    const auctionDuration = 24 * 60 * 60 // 1 day.
    const extraAuctionTime = 5 * 60 // 5 mins.
    const startingPrice = toWei(0)
    const bidIncrement = toWei(0.025)
    
    await auction.connect(deployer).initialize(
        figmata.address,
        auctionsAtSameTime,
        auctionDuration,
        extraAuctionTime,
        startingPrice,
        bidIncrement
    )

    await auction.connect(deployer).setTokensRequiredToHoldToBeVip([
        pixelady.address, pixeladyBc.address, milady.address, remilio.address
    ])

    await figmata.connect(deployer).addMinter(auction.address)
    
    console.log(`Pixelady Figmata address: ${figmata.address}`)
    console.log(`Auction address address: ${auction.address}`)
}

const productionDeployment = async () => {

    const FigmataAuctionFactory = await ethers.getContractFactory('FigmataAuction')
    const FigmataFactory = await ethers.getContractFactory('PixeladyFigmata')

    const [ deployer, ] = await ethers.getSigners()
    
    const pixeladyAddress = '0x8Fc0D90f2C45a5e7f94904075c952e0943CFCCfd'
    const pixeladyBcAddress = '0x4D40C64A8E41aC96b85eE557A434410672221750'
    const miladyAddress = '0x5Af0D9827E0c53E4799BB226655A1de152A425a5'
    const remilioAddress = '0xD3D9ddd0CF0A5F0BFB8f7fcEAe075DF687eAEBaB'

    const baseUri = 'ipfs://fakeUri' // TODO TODO TODO
    const maxSupply = 360
    const altPayoutPipeline = '0x6a6d59af77e75c5801bad3320729b81e888b5f09'
    const vipIds = [ 
        1, 7, 51, 55, 171, 81, 114, 180, 230, 211, 210, 17, 179, 247, 288, 308, 36
    ]

    const conf: ConfigStruct = {
        baseUri,
        maxSupply,
        platformFee: 500,
        ownerAltPayout: altPayoutPipeline,
        altPlatformPayout: ethers.constants.AddressZero,
    }
    
    const figmata = await FigmataFactory.connect(deployer).deploy(
        'Pixelady Figmata',
        'PXLDYFGMTA',
        conf
    )

    const auction = await FigmataAuctionFactory.connect(deployer).deploy()
    const auctionsAtSameTime = 10
    const auctionDuration = 24 * 60 * 60 // 1 day.
    const extraAuctionTime = 5 * 60 // 5 mins.
    const startingPrice = toWei(0)
    const bidIncrement = toWei(0.025)
    
    await auction.connect(deployer).initialize(
        figmata.address,
        auctionsAtSameTime,
        auctionDuration,
        extraAuctionTime,
        startingPrice,
        bidIncrement
    )

    await auction.connect(deployer).setTokensRequiredToHoldToBeVip([
        pixeladyAddress, pixeladyBcAddress, miladyAddress, remilioAddress
    ])

    await auction.connect(deployer).setVipIds(vipIds, true)
    
    console.log(`Pixelady Figmata address: ${figmata.address}`)
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

deploymentFunction()
    .then(() => console.log('Successful deployment :D'))
    .catch(e => console.log(`Something went wrong! ${e}`))

