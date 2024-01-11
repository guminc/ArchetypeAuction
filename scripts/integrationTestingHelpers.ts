import { ethers } from "hardhat";
import { getRandomFundedAccount, toWei } from "./helpers";
import { ConfigStruct } from "../typechain-types/contracts/tokens/FruitsMilady";

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
    const FigmataAuctionFactory = await ethers.getContractFactory('FruitsRemiliaAuction')
    const FigmataFactory = await ethers.getContractFactory('FruitsMilady')

    const [ deployer, ] = await ethers.getSigners()

    const conf: ConfigStruct = {
        baseUri: 'ipfs://fakeUri',
        maxSupply,
        platformFee: 500,
        ownerAltPayout,
        altPlatformPayout: superAffiliatePayout
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

    await figmata.connect(deployer).addMinter(auction.address)
    
    const user = await getRandomFundedAccount()

    return {
        deployer, auction, figmata, user,
    }
}
