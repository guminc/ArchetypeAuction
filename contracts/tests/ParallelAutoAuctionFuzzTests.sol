// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "./FuzzyParallelAutoAuction.sol";
import "../tokens/MinimalAuctionableNFT.sol";

contract ParallelAutoAuctionFuzzTest is FuzzyParallelAutoAuction {
    
    MinimalAuctionableNFT token = new MinimalAuctionableNFT("Test", "TEST", 360);

    uint8[10] possibleLineNumbers = [1,2,3,4,6,7,8,9,10];

    AuctionConfig public state = AuctionConfig(
        address(token),
        10,
        3 * 60, // 3 mins.
        30, // 30 secs.
        0 ether,
        0.025 ether
    );

    constructor() FuzzyParallelAutoAuction() {
        super.initialize(
            state.auctionedNft,
            state.lines,
            state.baseDuration,
            state.timeBuffer,
            state.startingPrice,
            state.bidIncrement
        );

        super.lockBaseDurationForever();
        super.lockTimeBufferForever();
        super.lockStartingPriceForever();
        super.lockBidIncrementForever();
    }
    
    function echidna_alwaystrue_auctioned_token_immutable() public view returns (bool) {
        return _auctionConfig.auctionedNft == address(token);
    }

    function echidna_alwaystrue_line_number_in_range(uint24 tokenId) public view returns (bool) {
        uint8 lineNumber = super.tokenIdToLineNumber(tokenId);

        for (uint8 i = 0; i < possibleLineNumbers.length; i++) 
            if (possibleLineNumbers[i] == lineNumber)
                return true;

        return false;
    }

    function echidna_alwaystrue_right_contract_balance_for_line(uint8 lineNumber) public view returns (bool) {
        return address(this).balance >= _lineToState[lineNumber].currentPrice;
    }

    function echidna_alwaystrue_exact_contract_balance() public view returns (bool) {
        uint96 finalPrice;
        for (uint8 i = 0; i < possibleLineNumbers.length; i++)
            finalPrice += _lineToState[possibleLineNumbers[i]].currentPrice;

        return address(this).balance >= finalPrice;
    }
    
    
}

