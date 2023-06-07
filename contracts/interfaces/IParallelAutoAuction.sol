// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./IEthAuction.sol";
import "./IHoldsParallelAutoAuctionData.sol";

interface IParallelAutoAuction is IEthAuction, IHoldsParallelAutoAuctionData {
    /**
     * @dev This method lets a user settle an auction after it ends,
     * It can also be used to claim the last auctioned `nftIds`s. Note that this
     * has to do with the original `BonklerAuction` contract, which automatically
     * settles auction when the auction for the next `nftId` starts.
     */
    function settleAuction(uint24 nftId) external;
}


