import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils"
import { parallelAutoAuction } from "./helpers"

const figmataMinimalDeployment = async () => {
    const { nft, auction, deployer } = await parallelAutoAuction({
        auctionsAtSameTime: 10,
        startingPrice: 0.1,
        bidIncrement: 0.05,
        auctionDuration: 4 * 60 * 60, // 4 hours
        extraAuctionTime: 5 * 60, // 5 mins 
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
