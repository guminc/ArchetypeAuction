import { ethers } from "hardhat";
import { ConfigStruct } from "../typechain-types/contracts/tokens/PixeladyFigmata";
import { getRandomFundedAccount, toWei } from "./helpers";

export const figmataIntegrationDeployment = async ({
    auctionsAtSameTime = 10,
    auctionDuration = 10,
    extraAuctionTime = 3,
    startingPrice = 0.1,
    bidIncrement = 0.05,
    maxSupply = 100,
    ownerAltPayout = ethers.constants.AddressZero,
    superAffiliatePayout = ethers.constants.AddressZero
}) => {
    const FigmataAuctionFactory = await ethers.getContractFactory('FigmataAuction')
    const FigmataFactory = await ethers.getContractFactory('PixeladyFigmata')
    // We deploy a fake ERC721 token to test VIP auctions with `FigmataAuction`.
    const PixeladyFactory = await ethers.getContractFactory('MinimalErc721')

    const [ deployer, ]= await ethers.getSigners()

    const pixelady = await PixeladyFactory.deploy()
    const pixeladyBc = await PixeladyFactory.deploy()
    const milady = await PixeladyFactory.deploy()
    const remilio = await PixeladyFactory.deploy()

    const conf: ConfigStruct = {
        baseUri: 'ipfs://fakeUri',
        maxSupply,
        platformFee: 500,
        ownerAltPayout,
        superAffiliatePayout
    }

    const figmata = await FigmataFactory.connect(deployer).deploy(
        'Pixelady Figmata',
        'FIGMATA',
        conf
    )

    const auction = await FigmataAuctionFactory.connect(deployer).deploy()
    
    await auction.connect(deployer).initialize(
        figmata.address,
        auctionsAtSameTime,
        auctionDuration,
        extraAuctionTime,
        toWei(startingPrice),
        toWei(bidIncrement)
    )

    await auction.connect(deployer).setTokensRequiredToHoldToBeVip([
        pixelady.address, pixeladyBc.address, milady.address, remilio.address
    ])
    await figmata.connect(deployer).addMinter(auction.address)
    
    const user = await getRandomFundedAccount()

    return {
        deployer, auction, figmata, user,
        pixelady, pixeladyBc, milady, remilio
    }
}
