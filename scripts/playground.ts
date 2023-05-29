import { ethers } from "hardhat"
import { IParallelAutoAuction, ParallelAutoAuction__factory } from "../typechain-types"

const figmataAuctionInteraction = async () => {
    const [acc, ] = await ethers.getSigners()
    const auction = new ethers.Contract(
        '0x349fea47fa67fAF75C9F301Adb5108aef49223ff',
        ParallelAutoAuction__factory.abi,
        acc
    ) as IParallelAutoAuction

    console.log(await auction.getAuctionedToken())
    console.log(await auction.lineState(3))
}


figmataAuctionInteraction()
    .then(() => process.exit(0))
    .catch(e => { console.log(e); process.exit(1) })
