import { ethers } from "hardhat"
import { ConfigStruct } from "../typechain-types/contracts/tokens/PixeladyFigmata"
import { toWei } from "./helpers"

// Haiiii :3 I use this script to test the figmata front-end on pre-production
const deployment = async () => {

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
        baseUri: 'ipfs://fakeuri',
        maxSupply: 360,
        platformFee: 500,
        ownerAltPayout: '0x6a6d59af77e75c5801bad3320729b81e888b5f09',
        altPlatformPayout: ethers.constants.AddressZero,
    }
    
    const figmata = await FigmataFactory.connect(deployer).deploy(
        'Pixelady Figmata', // TODO
        'PXLDYFGMTA',
        conf
    )

    const auction = await FigmataAuctionFactory.connect(deployer).deploy()
    const auctionsAtSameTime = 10
    const auctionDuration = 80
    const extraAuctionTime = 15
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

    const vipIds = [ 
        1, 7, 51, 55, 171, 81, 114, 180, 230, 211, 210, 17, 179, 247, 288, 308, 36, 323
    ]
    await auction.connect(deployer).setVipIds(vipIds, true)
    
    console.log(`Pixelady Figmata address: ${figmata.address}`)
    console.log(`Auction address: ${auction.address}`)
}

deployment()
    .then(() => console.log('DEPLOYED'))
    .catch(e => console.log(e))


