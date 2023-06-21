// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./FuzzyParallelAutoAuction.sol";
import "../tokens/MinimalAuctionableNFT.sol";

contract ParallelAutoAuctionFuzzTest is FuzzyParallelAutoAuction {
    
    MinimalAuctionableNFT token = new MinimalAuctionableNFT("Test", "TEST", 360);

    uint8[10] possibleLineNumbers = [1,2,3,4,5,6,7,8,9,10];

    AuctionConfig public state = AuctionConfig(
        address(token),
        10,
        5, // 5 secs.
        3, // 3 secs.
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

    function echidna_alwaystrue_right_contract_balance_for_line() public view returns (bool) {
        uint256 bal = address(this).balance;
        for (uint8 i = 0; i < 12; i++)
            if (_lineToState[i].currentPrice > bal) return false;
        return true;
    }
    
    function encodeLine(LineState memory l) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(l.head, l.startTime, l.endTime, l.currentWinner, l.currentPrice));
    }

    function echidna_alwaystrue_undefined_linestates() public view returns (bool) {
        LineState memory l = LineState(0,0,0,address(0),0);
        if (encodeLine(l) != encodeLine(_lineToState[0])) return false;
        for (uint8 i = 11; i < 255; i++) {
            if (encodeLine(l) != encodeLine(_lineToState[i])) 
                return false;
        }
        return true;
    }

    function echidna_alwaystrue_exact_contract_balance() public view returns (bool) {
        uint96 finalPrice;
        for (uint8 i = 0; i < possibleLineNumbers.length; i++)
            finalPrice += _lineToState[possibleLineNumbers[i]].currentPrice;

        return address(this).balance >= finalPrice;
    }
    
    // NOTE Im not sure if those work? Im not sure if echdina is smart enough for those?
    function test_always_refund(uint24 id) public payable {
        LineState memory line = _lineToState[tokenIdToLineNumber(id)];

        if (line.currentWinner == address(0) || block.timestamp > line.endTime) return;

        uint256 iniBal = line.currentWinner.balance;
        super.createBid(id);
        uint256 finalBal = line.currentWinner.balance;
        assert(iniBal + line.currentPrice == finalBal);
    }

    function test_always_mint_on_new_create_bid(uint24 id) public payable {
        LineState memory line = _lineToState[tokenIdToLineNumber(id)];

        if (line.currentWinner == address(0) || line.endTime >= block.timestamp) return;
        if (line.head + 10 > 360) return;

        uint256 iniBal = token.balanceOf(line.currentWinner);
        super.createBid(line.head + 10);
        uint256 finalBal = token.balanceOf(line.currentWinner);
        assert(finalBal == iniBal + 1);
    }

    function test_always_mint_on_settle(uint24 id) public payable {
        LineState memory line = _lineToState[tokenIdToLineNumber(id)];

        if (line.currentWinner == address(0) || line.endTime >= block.timestamp) return;

        uint256 iniBal = token.balanceOf(line.currentWinner);
        super.settleAuction(line.head);
        uint256 finalBal = token.balanceOf(line.currentWinner);
        assert(finalBal == iniBal + 1);
    }
    
    function test_always_secure_balances_on_new_create_bid(uint24 id) public payable {
        LineState memory line = _lineToState[tokenIdToLineNumber(id)];

        if (line.currentWinner == address(0) || line.endTime >= block.timestamp) return;
        if (line.head + 10 > 360) return;

        uint256 iniBal = address(token).balance;
        super.createBid(line.head + 10);
        uint256 finalBal = address(token).balance;
        assert(iniBal + line.currentPrice == finalBal);
    }

    function test_always_secure_balances_on_settle(uint24 id) public payable {
        LineState memory line = _lineToState[tokenIdToLineNumber(id)];

        if (line.currentWinner == address(0) || line.endTime >= block.timestamp) return;

        uint256 iniBal = address(token).balance;
        super.settleAuction(line.head);
        uint256 finalBal = address(token).balance;
        assert(iniBal + line.currentPrice == finalBal);
    }

    function test_line_number_in_range(uint24 tokenId) public view {
        uint8 lineNumber = super.tokenIdToLineNumber(tokenId);
        
        bool inRange = false;
        for (uint8 i = 0; i < possibleLineNumbers.length; i++) 
            if (possibleLineNumbers[i] == lineNumber)
                inRange = true;
        
        assert(inRange);
    } 

}

