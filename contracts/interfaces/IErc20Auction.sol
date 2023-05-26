// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./IAuctionInfo.sol";

interface IErc20Auction is IAuctionInfo {
    /**
     * @dev Create a `biddedAmount` ERC20 bid for a NFT.
     */
    function createBid(uint24 nftId, uint96 biddedAmount) external payable;
    
    /**
     * @return The ERC20 token used to pay the auction bids.
     */
    function getAuctionToken() external view returns (address);
}

