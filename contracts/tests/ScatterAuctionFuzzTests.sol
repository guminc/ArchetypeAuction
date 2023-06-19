// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "../ScatterAuction.sol";
import "../tokens/MinimalAuctionableNFT.sol";

contract ScatterAuctionFuzzTest is ScatterAuction {
    

    MinimalAuctionableNFT token = new MinimalAuctionableNFT("Test", "TEST", 30);

    AuctionState public state = AuctionState(
        address(token),
        1 ether,
        0.1 ether,
        uint40(block.timestamp + 3),
        uint40(block.timestamp + 100),
        5
    );

    constructor() ScatterAuction(
        state.auctionedNft,
        state.startingPrice,
        state.bidIncrement,
        state.startTime,
        state.endTime,
        state.timeBuffer
    ) {
        token.setMinter(address(this));
    }
    
    // Invariant: Contract should be immutable.
    function echidna_test_mutate_state() public view returns (bool) {
        return keccak256(abi.encodePacked(
            auctionState.auctionedNft,
            auctionState.startingPrice,
            auctionState.bidIncrement,
            auctionState.startTime,
            auctionState.endTime,
            auctionState.timeBuffer
        )) == keccak256(abi.encodePacked(
            state.auctionedNft,
            state.startingPrice,
            state.bidIncrement,
            state.startTime,
            state.endTime,
            state.timeBuffer
        ));
    }
    
}

