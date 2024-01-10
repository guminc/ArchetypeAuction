// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../FruitsAuction.sol";
import "../../tokens/Fruits.sol";

contract FruitsAuctionInvariants {

    Fruits private _token;
    Config private _tokenConfig;
    FruitsAuction private _auction;

    uint96 private _startingPrice = 0.1 ether;
    uint96 private _bidIncrement = 0.1 ether;
    uint8 private _maxId = 255;
    uint256 private _sharesPerBid = 3141592;

    constructor() {
        _tokenConfig = Config("", address(0), address(0), 6, 500);
        _token = new Fruits("Token", "TOKEN", _tokenConfig);

        _auction = new FruitsAuction();
        _auction.initialize(address(_token), _maxId, 86400, 900, _startingPrice, _bidIncrement);
        _auction.setSharesPerBid(_sharesPerBid);

        _auction.renounceOwnership();
        _token.renounceOwnership();
    }

    function assert_cant_bid_with_wrong_starting_price(uint96 diff, uint8 nftId) public payable {
        require(diff > 0 && nftId > 0 && nftId <= _maxId);
        _auction.createBid{value: _startingPrice - diff}(nftId);
        assert(false);
    }

    function assert_cant_outbid_with_wrong_bid_amount(uint96 diff, uint8 nftId) public payable {
        require(diff > 0 && nftId > 0 && nftId <= _maxId);
        uint96 currentPrice = _auction.getMinPriceFor(nftId);
        _auction.createBid{value: currentPrice - diff}(nftId);
        assert(false);
    }

    /**
     * @dev Becuase this auction is too long, it wont end during the fuzzer lifetime no
     *      matter what. Thus, no settling should be poossible.
     */
    function assert_cant_settle_at_all(uint24 nftId) public {
        _auction.settleAuction(nftId);
        assert(false);
    }

    function assert_cant_bid_with_ids_out_of_range(uint96 diff, uint24 nftId) public payable {
        require(nftId == 0 || nftId > _maxId);
        uint96 currentPrice = _auction.getMinPriceFor(nftId);
        _auction.createBid{value: currentPrice + diff}(nftId);
        assert(false);
    }

    function assert_right_contract_balance_after_bid(uint8 nftId, uint96 diff) public payable {
        require(nftId > 0 && nftId <= _maxId);
        uint96 currentPrice = _auction.getMinPriceFor(nftId);
        uint256 currentBalance = address(_auction).balance;
        _auction.createBid{value: currentPrice + diff}(nftId);
        assert(address(_auction).balance == currentBalance + _bidIncrement + diff);
    }

    function assert_right_line_after_bid(uint8 nftId, uint96 diff) public payable {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory oldLine = _auction.lineState(nftId);
        _auction.createBid{value: oldLine.currentPrice + _bidIncrement + diff}(nftId);
        LineState memory newLine = _auction.lineState(nftId);
        assert(newLine.currentWinner == msg.sender);
        assert(newLine.currentPrice == oldLine.currentPrice + _bidIncrement + diff);
    }

    function assert_right_shares_after_bid(uint8 nftId, uint96 diff) public payable {
        require(nftId > 0 && nftId <= _maxId);
        uint96 currentPrice = _auction.getMinPriceFor(nftId);
        uint256 currentShares = _auction.getTokenShares(msg.sender);
        _auction.createBid{value: currentPrice + diff}(nftId);
        assert(_auction.getTokenShares(msg.sender) == currentShares + _auction.getSharesPerBid());
    }

    function assert_contract_balance_ge_line_balance(uint8 nftId) public view {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        assert(address(_auction).balance >= line.currentPrice);
    }

    function assert_right_total_auction_balance() public view {
        LineState[] memory lines = _auction.lineStates();
        uint256 totalExpectedBalance = 0;

        for (uint256 i = 0; i < lines.length; i++)
            totalExpectedBalance += lines[i].currentPrice;

        assert(address(_auction).balance == totalExpectedBalance);
    }

    function assert_right_user_balances_after_outbid(uint8 nftId, uint96 diff) public payable {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.currentWinner != msg.sender && line.currentWinner != address(0));

        uint256 oldWinnerBalance = line.currentWinner.balance;
        uint256 newWinnerBalance = msg.sender.balance;

        _auction.createBid{value: line.currentPrice + _bidIncrement + diff}(nftId);

        assert(line.currentWinner.balance == oldWinnerBalance + line.currentPrice);
        assert(msg.sender.balance == newWinnerBalance - (_bidIncrement + diff));
    }

    function assert_right_user_balance_after_self_outbid(uint8 nftId, uint96 diff) public payable {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.currentWinner == msg.sender);

        uint256 initialUserBalance = msg.sender.balance;

        _auction.createBid{value: line.currentPrice + _bidIncrement + diff}(nftId);

        assert(msg.sender.balance == initialUserBalance - (_bidIncrement + diff));
    }

    function assert_right_state_on_first_bid(uint8 nftId, uint96 diff) public payable {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.currentWinner == address(0));

        uint256 initialZeroBalance = address(0).balance;
        uint256 initialUserBalance = msg.sender.balance;
        uint256 initialAuctionBalance = address(_auction).balance;

        assert(_auction.getMinPriceFor(nftId) == _startingPrice);
        _auction.createBid{value: _startingPrice + diff}(nftId);

        assert(initialZeroBalance == address(0).balance);
        assert(initialUserBalance == msg.sender.balance - (_startingPrice + diff));
        assert(initialAuctionBalance == address(_auction).balance + (_startingPrice + diff));

        LineState memory newLine = _auction.lineState(nftId);
        assert(newLine.currentWinner == msg.sender);
        assert(newLine.currentPrice == _startingPrice + diff);
    }

}
