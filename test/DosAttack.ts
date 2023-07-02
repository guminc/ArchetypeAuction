import { expect } from 'chai';
import { ethers } from "hardhat"
import { 
    getRandomFundedAccount,
    parallelAutoAuction,
    toWei 
} from "../scripts/helpers"

describe('DosAttack', async () => {
    it.only('shouldn\'t allow service denegation', async () => {
        const DosFactory = await ethers.getContractFactory('DosAttack')
        const hacker = await getRandomFundedAccount()

        const { auction, user } = await parallelAutoAuction({
            startingPrice: 0.01, bidIncrement: 0.01
        })

        const dos = await DosFactory.connect(hacker).deploy(auction.address)
        await dos.connect(hacker).hack(1, { value: toWei(0.01) })
        
        // It shouldn't revert.
        const tx = await auction.connect(user).createBid(1, { value: toWei(0.02) })
        const receipt = await tx.wait()
        expect(receipt.gasUsed).lt(200_000)
    })
})
