import { expect } from 'chai';
import { getContractBalance, getRandomAccount, sleep, toWei } from "../scripts/helpers"
import { figmataIntegrationDeployment } from "../scripts/integrationTestingHelpers"
import { ethers } from 'hardhat';

describe('AuraIntegrations', () => {
    it('should let withdraw on mainnet fork', async () => {
        const collectionOwnerAlt = await getRandomAccount()
        const { auction, user, figmata, deployer } = await figmataIntegrationDeployment({
            startingPrice: 0.1,
            auctionDuration: 1,
            extraAuctionTime: 0,
            auctionsAtSameTime: 1,
            ownerAltPayout: collectionOwnerAlt.address,
            maxSupply: 100
        })

        await auction.connect(user).createBid(1, { value: toWei(0.1) })
        await sleep(1)
        await auction.connect(user).createBid(2, { value: toWei(0.1) })

        expect(await figmata.balanceOf(user.address)).eq(1)
        expect(await getContractBalance(figmata)).eq(toWei(0.1))
        const scatterVault = await figmata
            .getPlatform()
            .then(ethers.getImpersonatedSigner)

        const iniScatterVaultBalance = await scatterVault.getBalance()

        await figmata.connect(deployer).withdraw()

        expect(await collectionOwnerAlt.getBalance()).eq(toWei(0.095))
        expect(await scatterVault.getBalance())
            .eq(iniScatterVaultBalance.add(toWei(0.005)))
        expect(await getContractBalance(figmata)).eq(0)
        expect(await getContractBalance(auction)).eq(toWei(0.1))
    })

    it('should let withdraw on mainnet fork with super affiliates', async () => {
        const collectionOwnerAlt = await getRandomAccount()
        const superAffiliate = await getRandomAccount()
        const { auction, user, figmata, deployer } = await figmataIntegrationDeployment({
            startingPrice: 0.1,
            auctionDuration: 1,
            extraAuctionTime: 0,
            auctionsAtSameTime: 1,
            ownerAltPayout: collectionOwnerAlt.address,
            superAffiliatePayout: superAffiliate.address,
            maxSupply: 100
        })

        await auction.connect(user).createBid(1, { value: toWei(0.1) })
        await sleep(1)
        await auction.connect(user).createBid(2, { value: toWei(0.1) })

        expect(await figmata.balanceOf(user.address)).eq(1)
        expect(await getContractBalance(figmata)).eq(toWei(0.1))
        const scatterVault = await figmata
            .getPlatform()
            .then(ethers.getImpersonatedSigner)

        const iniScatterVaultBalance = await scatterVault.getBalance()

        await figmata.connect(deployer).withdraw()

        expect(await collectionOwnerAlt.getBalance()).eq(toWei(0.095))
        expect(await scatterVault.getBalance())
            .eq(iniScatterVaultBalance.add(toWei(0.0025)))
        expect(await superAffiliate.getBalance()).eq(toWei(0.0025))
        expect(await getContractBalance(figmata)).eq(0)
        expect(await getContractBalance(auction)).eq(toWei(0.1))

    })

	it.only('check selector', async () => {
        const { auction, user } = await figmataIntegrationDeployment({})
		const k = await auction.connect(user).testAuctionPaused()	
		console.log(k)
	})
})
