import { ethers } from "hardhat"

const figmataAuctionInteraction = async () => {
  // const [acc] = await ethers.getSigners()
  const Factory = await ethers.getContractFactory("PixeladyFigmata")
  const auction = Factory.attach("0xE61443f7db3Ca8B7FC083602dcc52726db3d5Ff6")

  console.log(await auction.config())

  let overrides = {
    // gasLimit: 500000,
    gasPrice: ethers.utils.parseUnits("25", "gwei").toString(),
    type: 1,
    accessList: [
      {
        address: "0x86B82972282Dd22348374bC63fd21620F7ED847B", // proceedsRecipient gnosis safe proxy address
        storageKeys: [
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        ],
      },
      {
        address: "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552", // gnosis safe master address
        storageKeys: [],
      },
    ],
  }

  await auction.withdraw(overrides)
}

figmataAuctionInteraction()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e)
    process.exit(1)
  })
