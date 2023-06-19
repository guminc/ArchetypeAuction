import { expect } from 'chai';
import { ethers } from 'hardhat';
import { figmataIntegrationDeployment } from '../scripts/integrationTestingHelpers';
import { getContractBalance, getRandomAccount, getRandomFundedAccount, sleep, toWei } from '../scripts/helpers';

describe('FigmataIntegration', async () => {

    it('should allow basic withdrawal', async () => {
        const auctionDuration = 1
        const startingPrice = 0.01
        const { auction, user, figmata, deployer } = await figmataIntegrationDeployment({
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            auctionsAtSameTime: 1,
            bidIncrement: 0.011 // This case helped me solve a silly bug :D
        })

        const platform = await ethers.getImpersonatedSigner(await figmata.getPlatform())

        await auction.connect(user).createBid(1, { value: toWei(startingPrice) })

        const platformIniBal = await platform.getBalance()
        const deployerIniBal = await deployer.getBalance()

        await sleep(1)
        await auction.connect(user).settleAuction(1)
        await figmata.connect(user).withdraw()
        
        expect(await platform.getBalance()).equal(
            toWei(startingPrice).mul(5).div(100).add(platformIniBal)
        )

        expect(await deployer.getBalance()).equal(
            toWei(startingPrice).mul(95).div(100).add(deployerIniBal)
        )
    })

    it('should allow complex moneypipe', async () => {
        const auctionDuration = 1
        const startingPrice = 0.01

        const altDeployer = await getRandomAccount()
        const altPlatform = await getRandomAccount()

        const { auction, user, figmata, deployer } = await figmataIntegrationDeployment({
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            auctionsAtSameTime: 1,
            bidIncrement: 0.05,
            ownerAltPayout: altDeployer.address,
            superAffiliatePayout: altPlatform.address
        })

        const platform = await ethers.getImpersonatedSigner(await figmata.getPlatform())

        await auction.connect(user).createBid(1, { value: toWei(startingPrice) })

        const platformIniBal = await platform.getBalance()
        const deployerIniBal = await deployer.getBalance()

        await sleep(1)
        await auction.connect(user).settleAuction(1)
        await figmata.connect(user).withdraw()
        
        expect(await platform.getBalance()).equal(
            toWei(startingPrice).mul(25).div(1000).add(platformIniBal)
        )

        expect(await altPlatform.getBalance()).equal(
            toWei(startingPrice).mul(25).div(1000)
        )

        expect(await deployer.getBalance()).equal(deployerIniBal)

        expect(await altDeployer.getBalance()).equal(
            toWei(startingPrice).mul(95).div(100)
        )
    })

    it('should allow free bidding', async () => {
        const auctionDuration = 1
        const startingPrice = 0
        const bidIncrement = 0.025

        const { auction, user } = await figmataIntegrationDeployment({
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            auctionsAtSameTime: 1,
            bidIncrement
        })

        await auction.connect(user).createBid(1, { value: 0 })
    })

    it('should allow free bidding and claiming', async () => {
        const auctionDuration = 1
        const startingPrice = 0
        const bidIncrement = 0.025

        const { auction, user, figmata } = await figmataIntegrationDeployment({
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            auctionsAtSameTime: 1,
            bidIncrement
        })

        await auction.connect(user).createBid(1, { value: 0 })
        await sleep(auctionDuration)
        await auction.settleAuction(1)
        expect(await figmata.balanceOf(user.address)).equal(1)
    })

    it('should allow healthy outbidding on free bids', async () => {
        const auctionDuration = 2
        const startingPrice = 0
        const bidIncrement = 0.025

        const { auction, user, figmata } = await figmataIntegrationDeployment({
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            auctionsAtSameTime: 1,
            bidIncrement
        })

        const outbidder = await getRandomFundedAccount()
    
        const iniUserBal = await user.getBalance()
        const iniOutbidderBal = await outbidder.getBalance()

        await auction.connect(user).createBid(1, { value: 0 })
        await expect(auction.connect(outbidder).createBid(
            1, { value: toWei(bidIncrement).sub(1) }
        )).reverted

        await auction.connect(outbidder).createBid(1, { value: toWei(bidIncrement) })

        await sleep(auctionDuration)
        await auction.settleAuction(1)
        expect(await figmata.balanceOf(outbidder.address)).equal(1)
        expect(await figmata.balanceOf(user.address)).equal(0)
        expect(await user.getBalance()).approximately(iniUserBal, toWei(0.001))
        expect(await outbidder.getBalance()).approximately(
            iniOutbidderBal.sub(toWei(bidIncrement)), toWei(0.001)
        )
        expect(await getContractBalance(figmata)).equal(toWei(bidIncrement))
    })

    it('shouldn\'t allow wrong outbids', async () => {
        const auctionDuration = 10
        const startingPrice = 0
        const bidIncrement = 0.025

        const { auction, user } = await figmataIntegrationDeployment({
            auctionDuration, 
            extraAuctionTime: 0,
            startingPrice,
            auctionsAtSameTime: 1,
            bidIncrement
        })

        const outbidder = await getRandomFundedAccount()

        await auction.connect(user).createBid(1, { value: 0 })
        
        await expect(auction.connect(outbidder).createBid(
            1, { value: toWei(bidIncrement).sub(1) }
        )).reverted

        await auction.connect(outbidder).createBid(1, { value: toWei(bidIncrement) })

        await expect(auction.connect(outbidder).createBid(
            1, { value: toWei(bidIncrement).mul(2).sub(1) }
        )).reverted

        await auction.connect(outbidder).createBid(1, { value: toWei(bidIncrement).mul(2) })

        await expect(auction.connect(outbidder).createBid(
            1, { value: toWei(bidIncrement).mul(3).sub(1) }
        )).reverted

        await auction.connect(outbidder).createBid(1, { value: toWei(bidIncrement).mul(3) })

    })

    it('should allow minting out', async () => {
        expect(1).equals(2)
        // TODO
    })

});

