import { ethers } from "hardhat"
import { toWei } from "./helpers"
import { ConfigStruct } from "../typechain-types/contracts/tokens/FruitsMilady"

const preProdTestnetDeployment = async () => {

    const [ deployer, ] = await ethers.getSigners()
    const FruitsRemiliaAuctionFactory = await ethers.getContractFactory('FruitsRemiliaAuction')
    const FruitsMiladyFactory = await ethers.getContractFactory('FruitsMilady')
    const KagamiTokenFactory = await ethers.getContractFactory('Kagami')


    /* Fruits Milady Token Deployment */
    const baseUri = 'TODO' // TODO

    const conf: ConfigStruct = {
        baseUri,
        maxSupply: 6,
        platformFee: 500,
        ownerAltPayout: ethers.constants.AddressZero,
        altPlatformPayout: ethers.constants.AddressZero,
    }
    
    const fruitsMilady = await FruitsMiladyFactory.connect(deployer).deploy(
        'FRUiTS MiLADY',
        'FRUITSMILADY',
        conf
    )


    /* Auction Integration */
    const auction = await FruitsRemiliaAuctionFactory.connect(deployer).deploy()
    const auctionsAtSameTime = 6
    const auctionDuration = 10 * 60 // 10 mins.
    const extraAuctionTime = 3 * 60 // 3 mins.
    const startingPrice = toWei(0.01)
    const bidIncrement = toWei(0.01)
    
    await auction.connect(deployer).initialize(
        fruitsMilady.address,
        auctionsAtSameTime,
        auctionDuration,
        extraAuctionTime,
        startingPrice,
        bidIncrement
    )


    /* Reward Token Integration */
    const kagami = await KagamiTokenFactory.connect(deployer).deploy('Kagami', 'KAGAMI')
    await kagami
        .connect(deployer)
        .setMaxSupply(toWei(10000))
        .then(tx => tx.wait())
    await kagami
        .connect(deployer)
        .setSharesHolder(auction.address)
        .then(tx => tx.wait())
    await auction
        .connect(deployer)
        .addSharesUpdater(kagami.address)
        .then(tx => tx.wait())


    /* Auction start */
    await fruitsMilady
        .connect(deployer)
        .addMinter(auction.address)
        .then(tx => tx.wait())

    console.log(`FruitsMilady address: ${fruitsMilady.address}`)
    console.log(`Auction address: ${auction.address}`)
    console.log(`Kagami reward token address: ${kagami.address}`)
}

const productionDeployment = async () => {
    // TODO
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
