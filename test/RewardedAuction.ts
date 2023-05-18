import { ethers } from 'hardhat'
import { expect } from 'chai';

import { 
    RewardedAuction,
} from '../typechain-types';
import { auctionFactory, toWei } from '../scripts/helpers';

describe('RewardedAuction', () => {
    it('should allow saving bid shares', async () => {
        const { auction } = await auctionFactory({ 
            auctionType: 'RewardedAuction', reservePrice: 0.01, bidIncrement: 0.01
        })
        const sharedAuction = auction as RewardedAuction

        const [owner, bidder1, bidder2] = await ethers.getSigners()
        
        // NOTE in a real integration, the sharew updater would be a rewards distributor
        const sharesUpdater = owner
        await sharedAuction.connect(owner).addSharesUpdater(sharesUpdater.address)

        expect(await sharedAuction.getTokenShares(owner.address)).to.equal(0)
        expect(await sharedAuction.getTokenShares(bidder1.address)).to.equal(0)

        await sharedAuction.connect(bidder1).createBid(1, 0, {value: toWei(0.01)})

        expect(await sharedAuction.getTokenShares(owner.address)).to.equal(0)
        expect(await sharedAuction.getTokenShares(bidder1.address)).to.equal(toWei(0.01))

        await sharedAuction.connect(bidder1).createBid(1, 0, {value: toWei(0.02)})

        expect(await sharedAuction.getTokenShares(bidder1.address)).to.equal(toWei(0.03))

        await sharedAuction.connect(bidder2).createBid(1, 0, {value: toWei(0.035)})

        expect(await sharedAuction.getTokenShares(bidder1.address)).to.equal(toWei(0.03))
        expect(await sharedAuction.getTokenShares(bidder2.address)).to.equal(toWei(0.035))

    })

    it('should allow claiming bid shares', async () => {
        const { auction } = await auctionFactory({ 
            auctionType: 'RewardedAuction', reservePrice: 0.01, bidIncrement: 0.01
        })
        const sharedAuction = auction as RewardedAuction

        const [owner, bidder1, bidder2] = await ethers.getSigners()
        
        // NOTE in a real integration, the sharew updater would be a rewards distributor
        const sharesUpdater = owner
        await sharedAuction.connect(owner).addSharesUpdater(sharesUpdater.address)

        expect(await sharedAuction.getTokenShares(bidder1.address)).to.equal(0)
        expect(await sharedAuction.getTokenShares(bidder2.address)).to.equal(0)

        await sharedAuction.connect(bidder1).createBid(1, 0, {value: toWei(0.01)})
        await sharedAuction.connect(bidder1).createBid(1, 0, {value: toWei(0.02)})
        await sharedAuction.connect(bidder2).createBid(1, 0, {value: toWei(0.035)})
        
        await sharedAuction.connect(sharesUpdater).getAndClearSharesFor(bidder1.address)
        
        expect(await sharedAuction.getTokenShares(bidder1.address)).to.equal(0)
        expect(await sharedAuction.getTokenShares(bidder2.address)).to.equal(toWei(0.035))
    })
    
})
