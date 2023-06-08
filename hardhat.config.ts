import * as dotenv from 'dotenv'
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

dotenv.config()
const privateKey = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
    solidity: '0.8.18',
    defaultNetwork: 'hardhat',
    gasReporter: {
        enabled: true,
        coinmarketcap: process.env.CMC_API_KEY,
        outputFile: 'gasReports'
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_KEY
    },
    networks: {
        hardhat: {
            mining: {
                auto: true,
                interval: 1000
            }
        },
        sepolia: {
            accounts: [privateKey],
            url: 'https://sepolia.infura.io/v3/569cee6284754b9e86ff2e5e55a0dc22',
            chainId: 11155111
        }
    }
};

export default config;
