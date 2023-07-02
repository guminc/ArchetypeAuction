import { expect } from 'chai';
import { 
    getContractBalance,
    getRandomAccount,
    getRandomFundedAccount,
    mkMinBid,
    parallelAutoAuction,
    sleep,
    toWei,
} from '../scripts/helpers';

describe('ParallelRewardedAuction', async () => {

    it('should allow holding shares', async () => {
        const startingPrice = 0.1 
        const bidIncrement = 0.05

        const { auction, nft } = await parallelAutoAuction({
            startingPrice, bidIncrement
        })
        
        const bidder = await getRandomFundedAccount()
        const bidder1 = await getRandomFundedAccount()

        const bid1 = toWei(startingPrice)
        await auction.connect(bidder).createBid(1, { value: bid1 })
        expect(await auction.getTokenShares(bidder.address)).to.equals(bid1)
        
        const bid2 = toWei(startingPrice).add(toWei(bidIncrement))
        await auction.connect(bidder1).createBid(1, { value: bid2 })
        expect(await auction.getTokenShares(bidder.address)).to.equals(bid1)
        expect(await auction.getTokenShares(bidder1.address)).to.equals(bid2)

        const bid3 = toWei(bidIncrement).mul(2).add(toWei(startingPrice))
        const bid4 = toWei(bidIncrement).mul(4).add(toWei(startingPrice))
        
        await auction.connect(bidder).createBid(1, { value: bid3 })
        expect(await auction.getTokenShares(bidder.address)).to.equals(bid1.add(bid3))
        expect(await auction.getTokenShares(bidder1.address)).to.equals(bid2)

        await auction.connect(bidder).createBid(1, { value: bid4 })
        expect(await auction.getTokenShares(bidder.address)).to.equals(bid1.add(bid3).add(bid4))
        expect(await auction.getTokenShares(bidder1.address)).to.equals(bid2)

    })

});

