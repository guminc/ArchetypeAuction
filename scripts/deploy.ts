import { parallelAutoAuction, sleep } from "./helpers"

const figmataTestnetDeployment = async () => {
    const { nft, auction, deployer } = await parallelAutoAuction({
        auctionsAtSameTime: 10,
        startingPrice: 0.01,
        bidIncrement: 0.005,
        auctionDuration: 60 * 3, // 3 mins
        extraAuctionTime: 60, // 1 min
        mainnet: true,
        maxSupply: 40
    })
    
    console.log(`Auction contract: ${auction.address}`)
    console.log(`Nft deployed: ${nft.address}`)
    console.log(`Deployed by: ${deployer.address}`)
}


figmataTestnetDeployment()
    .then(() => process.exit(0))
    .catch(e => { console.log(e); process.exit(1) })
