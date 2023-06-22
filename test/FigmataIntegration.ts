import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import { figmataIntegrationDeployment } from '../scripts/integrationTestingHelpers';
import { fromWei, getContractBalance, getLastTimestamp, getRandomAccount, getRandomFundedAccount, sleep, toWei } from '../scripts/helpers';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

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

    it.skip('should allow minting out', async () => {
        const auctionsAtSameTime = 3
        const auctionDuration = 30
        const extraAuctionTime = 15
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
            // NOTE This should be protected with a mutex if we really
            // want the contract bals checks to work.
            const iniAuctionBal = await getContractBalance(auction)
            const bidder = await getRandomFundedAccount()

            bidForId[id] = value
            await auction.connect(bidder).createBid(id, { value })

            const settleDecrement = line.currentWinner === ethers.constants.AddressZero
                ? iniAuctionBal
                : toWei(0)

            expect(await getContractBalance(auction)).equal(
                iniAuctionBal.add(value).sub(line.currentPrice).sub(settleDecrement)
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
            const iniContractBal = await getContractBalance(figmata)
            const iniSupply = await figmata.totalSupply() 

            await auction
                .connect(await getRandomFundedAccount())
                .settleAuction(id)
            
            expect(await getContractBalance(figmata)).equal(
                iniContractBal.add(bidForId[id])
            )

            expect(await figmata.totalSupply()).equal(iniSupply.add(1))
        }

        const trybid = async (id: number, value: BigNumber | 'max' | 'debug') => {
            const hacker = await getRandomFundedAccount()
            const gasPrice = toWei(0.01)

            const bidAmount = value === 'max' || value === 'debug'
                ? (await hacker.getBalance()).sub(gasPrice) 
                : value
            
            if (value === 'debug') {
                console.log(await hacker.getBalance())
                console.log(bidAmount)
            }
            try {
                await auction.connect(hacker).createBid(
                    id, { value: bidAmount }
                )
                assert(false)
            } catch {
                assert(true)
            }
            //await expect(auction.connect(hacker).createBid(
            //    id, { value: bidAmount }
            //)).reverted
        }

        const miniFuzzer = async () => {
            const promises: Promise<any>[] = [];
            [1,2,3].map(async (i: number) => {
                const line = await auction.lineState(i)
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
            const line = await auction.lineState(id)
            if (line.head !== id) return 
            await sleep(0.5)
            await waitToEnd(id)
        }

        const waitToAlmostEnd = async (id: number) => {
            const t = await getLastTimestamp()
            const line = await auction.lineState(id)

            if (t + 8 >= line.endTime) return
            await sleep(0.5)
            await waitToAlmostEnd(id)
        }

        const fstLineComputations = async () => {
            await miniFuzzer() 
            // Id 1
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
            // Id 4
            await randombid(4, startingPrice.add(bidIncrement).sub(1))
            await miniFuzzer()
            await randombid(4, bidForId[4].add(bidIncrement))
            await miniFuzzer()
            await randombid(4, bidForId[4].add(bidIncrement).add(1))
            await miniFuzzer()
            await waitToEnd(4)
            await miniFuzzer()
            await settle(4)
            await miniFuzzer()
            // Id 7
            await randombid(7, startingPrice.add(1))
            await miniFuzzer()
            await waitToEnd(7)
            await miniFuzzer()
            // Id 10
            await randombid(10, startingPrice.add(bidIncrement).add(1))
            await miniFuzzer()
            await randombid(10, bidForId[10].add(bidIncrement))
            await miniFuzzer()
            await randombid(10, bidForId[10].add(bidIncrement).add(32))
            await miniFuzzer()
            await randombid(10, bidIncrement.mul(2).add(bidForId[10]))
            await miniFuzzer()
            await randombid(10, bidIncrement.mul(2).add(bidForId[10]).sub(1))
            await miniFuzzer()
            await waitToEnd(10)
            await miniFuzzer()
            await miniFuzzer()
            await settle(10)
            await miniFuzzer()
        }

        const sndLineComputations = async () => {
            // Id 2
            await randombid(2, startingPrice)
            await miniFuzzer() 
            await randombid(2, bidForId[2].add(bidIncrement))
            await miniFuzzer() 
            await randombid(2, bidForId[2].add(bidIncrement).add(123))
            await miniFuzzer() 
            await waitToAlmostEnd(2)
            await randombid(2, bidForId[2].add(bidIncrement))
            await miniFuzzer() 
            await Promise.all([
                miniFuzzer(),
                waitToEnd(2),
                miniFuzzer()
            ])
            await miniFuzzer()
            // Id 5
            await randombid(5, startingPrice.add(bidIncrement).sub(1))
            await miniFuzzer()
            await randombid(5, bidForId[5].add(bidIncrement))
            await miniFuzzer()
            await randombid(5, bidForId[5].add(bidIncrement).add(1))
            await miniFuzzer()
            await waitToEnd(5)
            await miniFuzzer()
            await settle(5)
            await miniFuzzer()
            // Id 8
            await randombid(8, startingPrice.add(1))
            await miniFuzzer()
            await waitToEnd(8)
            await miniFuzzer()
            // Id 11
            await randombid(11, startingPrice.add(bidIncrement).add(1))
            await miniFuzzer()
            await randombid(11, bidForId[11].add(bidIncrement))
            await miniFuzzer()
            await randombid(11, bidForId[11].add(bidIncrement).add(32))
            await miniFuzzer()
            await randombid(11, bidIncrement.mul(2).add(bidForId[11]))
            await miniFuzzer()
            await randombid(11, bidIncrement.mul(2).add(bidForId[11]).sub(1))
            await miniFuzzer()
            await waitToEnd(11)
            await miniFuzzer()
            await miniFuzzer()
            await settle(11)
            await miniFuzzer()
        }

        const finalAttacks = async () => {
            await trybid(10, 'debug')
            await trybid(11, 'max')
            await trybid(12, 'max')
            await trybid(13, 'max')
            await trybid(1, 'max')
            await trybid(2, 'max')
            await trybid(4, 'max')
            await trybid(5, 'max')
            await trybid(7, 'max')
            await trybid(8, 'max')
            await trybid(10, 'max')
            await trybid(11, 'max')
            await trysettle(10)
            await trysettle(11)
            await trysettle(12)
            await trysettle(13)
            await trysettle(1)
            await trysettle(2)
            await trysettle(4)
            await trysettle(5)
            await trysettle(7)
            await trysettle(8)
            await trysettle(10)
            await trysettle(11)

            expect(await getContractBalance(auction)).equal(0)
            await randombid(3, startingPrice)
        }

        await fstLineComputations()
        await sndLineComputations()
        await finalAttacks()

    }).timeout(200_000)

    it('should allow vip bidding', async () => {
        const { 
            auction, user, figmata, deployer,
            pixelady, pixeladyBc, milady, remilio
        } = await figmataIntegrationDeployment({
            auctionsAtSameTime: 10,
            auctionDuration: 10,
            extraAuctionTime: 5,
            startingPrice: 0,
            bidIncrement: 0.025
        })

        const hacker = await getRandomFundedAccount()
        
        const vipIds = [
            1, 7, 51, 55, 171, 81, 114, 180, 230,
            211, 210, 17, 179, 247, 288, 308, 36   
        ]

        await expect(auction.connect(hacker).setVipIds(vipIds, true)).reverted
        await auction.connect(deployer).setVipIds(vipIds, true)
        
        const mkbid = async (id: number, acc: SignerWithAddress | null = null) => auction
            .connect(acc === null ? await getRandomFundedAccount() : acc)
            .createBid(id, { 
                value: (await auction.lineState(id)).currentPrice.add(toWei(0.025)) 
            })

        await expect(mkbid(1)).reverted
        await expect(mkbid(7)).reverted
        await mkbid(2)

        const holderOfOne = await getRandomFundedAccount()
        await pixeladyBc.connect(deployer).mint(holderOfOne.address, 721)

        const holderOfAll = await getRandomFundedAccount()
        await pixeladyBc.connect(deployer).mint(holderOfAll.address, 13)
        await pixelady.connect(deployer).mint(holderOfAll.address, 11)
        await milady.connect(deployer).mint(holderOfAll.address, 3000)
        await remilio.connect(deployer).mint(holderOfAll.address, 721)

        await mkbid(7, holderOfOne)
        await expect(mkbid(7)).reverted
        await mkbid(7, holderOfAll)
        await mkbid(1, holderOfAll)
        expect(await auction.connect(holderOfOne).userIsVip(holderOfOne.address)).true
        expect(await auction.connect(holderOfAll).userIsVip(holderOfOne.address)).true
        expect(await auction.connect(hacker).userIsVip(hacker.address)).false
    })

});

