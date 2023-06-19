import { ethers } from "hardhat";
import { ConfigStruct } from "../typechain-types/contracts/tokens/PixeladyFigmata";
import { toWei } from "./helpers";

export const figmataIntegrationDeployment = async () => {
    const FigmataAuctionFactory = await ethers.getContractFactory('FigmataAuction')
    const FigmataFactory = await ethers.getContractFactory('PixeladyFigmata')
    // We deploy a fake ERC721 token to test VIP auctions with `FigmataAuction`.
    const PixeladyFactory = await ethers.getContractFactory('MinimalErc721')

    const [ deployer, ]= await ethers.getSigners()

    const pixelady = await PixeladyFactory.deploy()

    const conf: ConfigStruct = {
        baseUri: 'ipfs://fakeUri',
        maxSupply: 400,
        platformFee: 500,
        ownerAltPayout: ethers.constants.AddressZero,
        superAffiliatePayout: ethers.constants.AddressZero
    }

    const figmata = await FigmataFactory.connect(deployer).deploy(
        'Pixelady Figmata',
        'FIGMATA',
        conf
    )

    const auction = await FigmataAuctionFactory.connect(deployer).deploy()
    
    await auction.connect(deployer).initialize(
        figmata.address,
        10, // Lines
        100, // Auction duration in secs.
        10, // Extra duration in secs.
        toWei(0.1), // Base price.
        toWei(0.05) // Bid increment.
    )

    await auction.connect(deployer).setTokenRequiredToHoldToBeVip(pixelady.address)
    await figmata.connect(deployer).addMinter(auction.address)

    return {
        deployer, pixelady, auction, figmata
    }
}
