import { expect } from 'chai';
import { ethers } from 'hardhat';
import { figmataIntegrationDeployment } from '../scripts/integrationTestingHelpers';
import { fromWei, getContractBalance, getLastTimestamp, getRandomAccount, getRandomFundedAccount, sleep, toWei } from '../scripts/helpers';
import { BigNumber } from 'ethers';
import { FigmataAuction__factory } from '../typechain-types';

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

    it.only('should allow minting out', async () => {
        const auctionsAtSameTime = 3
        const auctionDuration = 30
        const extraAuctionTime = 10
        const startingPrice = toWei(0)
        const bidIncrement = toWei(0.025)
        const maxSupply = 12

        const { 
            auction, figmata, user
        } = await figmataIntegrationDeployment({
            auctionsAtSameTime,
            auctionDuration,
            extraAuctionTime,
            startingPrice: Number(fromWei(startingPrice)),
            bidIncrement: Number(fromWei(bidIncrement)),
            maxSupply
        })
        
        const bidForId = new Array<BigNumber>(13)

        const randombid = async (id: number, value: BigNumber) => {
            const line = await auction.lineState(id)
            const iniAuctionBal = await getContractBalance(auction)
            const bidder = await getRandomFundedAccount()

            bidForId[id] = value
            await auction.connect(bidder).createBid(id, { value })
            
            expect(await getContractBalance(auction)).equal(
                iniAuctionBal.add(value).sub(line.currentPrice)
            )
            
            const balIncrement = line.currentWinner === ethers.constants.AddressZero 
                ? startingPrice
                : bidIncrement

            expect(line.currentPrice.add(value)).greaterThanOrEqual(
                line.currentPrice.add(balIncrement)
            )
        }

        const trysettle = async (id: number) => {
            const hacker = await getRandomFundedAccount()
            await expect(auction.connect(hacker).settleAuction(id)).reverted
        }
    
        const settle = async (id: number) => {
            const line = await auction.lineState(id)
            const iniContractBal = await getContractBalance(figmata)
            const iniWinnerBal = await figmata.balanceOf(line.currentWinner)

            await auction
                .connect(await getRandomFundedAccount())
                .settleAuction(id)
            
            expect(await getContractBalance(figmata)).equal(
                iniContractBal.add(line.currentPrice)
            )

            expect(await figmata.balanceOf(line.currentWinner)).equal(
                iniWinnerBal.add(1)
            )
        }

        const trybid = async (id: number, value: BigNumber | 'max') => {
            const hacker = await getRandomFundedAccount()
            const gasPrice = toWei(0.01)
            const bidAmount = value === 'max'
                ? (await hacker.getBalance()).sub(gasPrice) 
                : value

            await expect(auction.connect(hacker).createBid(
                id, { value: bidAmount }
            )).reverted
        }

        const miniFuzzer = async () => {
            const promises: Promise<any>[] = [];

            [1,2,3].map(async (id: number) => {
                const line = await auction.lineState(id)

                if (line.currentWinner !== ethers.constants.AddressZero)
                    promises.push(trysettle(line.head))

                if (line.currentPrice.eq(0)) {
                    if (startingPrice.gt(0)) 
                        promises.push(trybid(line.head, startingPrice.sub(1)))
                } else
                    promises.push(trybid(line.head, line.currentPrice.add(bidIncrement).sub(1)))

                if (line.head > 3)
                    promises.push(trybid(line.head-3, 'max'))
                promises.push(trybid(line.head+3, 'max'))
            })

            await Promise.all(promises)
        }


        const waitToEnd = async (id: number) => {
            const promises: Promise<any>[] = []
            while (true) {
                const line = await auction.lineState(id)
                if (line.head !== id) break
                await sleep(0.5)
                promises.push(miniFuzzer())
            }
            await Promise.all(promises)
        }

        const waitToAlmostEnd = async (id: number) => {
            const t = await getLastTimestamp()
            const line = await auction.lineState(id)

            if (t + 6 >= line.endTime) return
            await sleep(0.5)
            await waitToAlmostEnd(id)
        }

        const fstLineComputations = async () => {
            await miniFuzzer() 
            await randombid(1, startingPrice)
            await miniFuzzer() 
            await randombid(1, bidForId[1].add(bidIncrement))
            await miniFuzzer() 
            await randombid(1, bidForId[1].add(bidIncrement).add(123))
            await miniFuzzer() 
            await waitToAlmostEnd(1)
            await randombid(1, bidForId[1].add(bidIncrement))
            await miniFuzzer() 
            await Promise.all([
                miniFuzzer(),
                waitToEnd(1),
                miniFuzzer()
            ])
            await miniFuzzer()
            await randombid(4, startingPrice.add(bidIncrement).sub(1)) // Fails!
            await miniFuzzer()
        }

        const sndLineComputations = async () => {
            
        }

        const thdLineComputations = async () => {
            
        }
        
        await Promise.all([
            fstLineComputations(),
            sndLineComputations(),
            thdLineComputations()
        ])

    })

});

