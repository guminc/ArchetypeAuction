import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils"
import { parallelAutoAuction } from "./helpers"

const figmataMinimalDeployment = async () => {
    const { nft, auction, deployer } = await parallelAutoAuction({
        auctionsAtSameTime: 10,
        startingPrice: 0.01,
        bidIncrement: 0.005,
        auctionDuration: 60 * 3, // 3 mins
        extraAuctionTime: 60, // 1 min
        mainnet: true
    })

    console.log(`Auction contract: ${auction.address}`)
    console.log(`Nft deployed: ${nft.address}`)
    console.log(`Nft auctioned: ${await auction.getAuctionedToken()}`)
    console.log(`Deployed by: ${deployer.address}`)
    console.log('Lines:')
    console.log(await auction.lineStates())
}


figmataMinimalDeployment()
    .then(() => process.exit(0))
    .catch(e => { console.log(e); process.exit(1) })
