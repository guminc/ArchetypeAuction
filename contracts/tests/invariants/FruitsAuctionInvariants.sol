// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../FruitsAuction.sol";
import "../../tokens/Fruits.sol";
import "./Account.sol";
import "solady/src/utils/SafeTransferLib.sol";

contract FruitsAuctionInvariants {

    Fruits private _token;
    Config private _tokenConfig;
    FruitsAuction private _auction;

    uint96 private _startingPrice = 0.1 ether;
    uint96 private _bidIncrement = 0.1 ether;
    uint8 private _maxId = 254;
    uint256 private _sharesPerBid = 3141592;

    Account private _user1 = new Account();
    Account private _user2 = new Account();
    Account private _user3 = new Account();

    enum User { USER1, USER2, USER3 }

    constructor() {
        _tokenConfig = Config("", address(0), address(0), _maxId, 500);
        _token = new Fruits("Token", "TOKEN", _tokenConfig);

        _auction = new FruitsAuction();

        _auction.initialize(address(_token), _maxId, 86400, 900, _startingPrice, _bidIncrement);
        _auction.setSharesPerBid(_sharesPerBid);

        _token.addMinter(address(this));

        uint256 bal = address(this).balance/3;
        SafeTransferLib.forceSafeTransferETH(address(_user1), bal);
        SafeTransferLib.forceSafeTransferETH(address(_user2), bal);
        SafeTransferLib.forceSafeTransferETH(address(_user3), bal);
    }

    function assert_can_bid() public payable {
        // _user1.pay(
        //     address(_auction),
        //     abi.encodeCall(_auction.createBid, 1),
        //     _startingPrice
        // );

        // (bool success,) = payable(address(_auction)).call{value: _startingPrice}(
        //     abi.encodeCall(_auction.createBid, 1)
        // );
        //require(success);
        _auction.createBid{value: _startingPrice}(1);
        assert(false);
    }

    /*
    function getUser(User userId) public view returns (Account) {
        if (userId == User.USER1) return _user1;
        if (userId == User.USER2) return _user2;
        return _user3;
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
    }*/

    /**
     * @dev Becuase this auction is too long, it wont end during the fuzzer lifetime no
     *      matter what. Thus, no settling should be poossible.
     */
    /*
    function assert_cant_settle_at_all(uint24 nftId) public {
        _auction.settleAuction(nftId);
        assert(false);
    }

    function assert_nft_balance_null() public view {
        assert(address(_token).balance == 0); 
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

    function assert_right_line_after_bid(uint8 nftId, uint96 diff, User userId) public payable {
        Account user = getUser(userId);
        require(nftId > 0 && nftId <= _maxId);
        LineState memory oldLine = _auction.lineState(nftId);
        
        user.pay{value: oldLine.currentPrice + _bidIncrement + diff}(
            address(_auction), abi.encodeWithSelector(_auction.createBid.selector, nftId)
        );

        LineState memory newLine = _auction.lineState(nftId);
        assert(newLine.currentWinner == address(user));
        assert(newLine.currentPrice == oldLine.currentPrice + _bidIncrement + diff);
    }

    function assert_right_shares_after_bid(uint8 nftId, uint96 diff, User userId) public payable {
        Account user = getUser(userId);
        require(nftId > 0 && nftId <= _maxId);
        uint96 currentPrice = _auction.getMinPriceFor(nftId);
        uint256 currentShares = _auction.getTokenShares(address(user));

        user.pay{value: currentPrice + diff}(
            address(_auction), abi.encodeWithSelector(_auction.createBid.selector, nftId)
        );

        assert(_auction.getTokenShares(address(user)) == currentShares + _auction.getSharesPerBid());
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

    function assert_right_user_balances_after_outbid(uint8 nftId, uint96 diff, User userId) public payable {
        Account user = getUser(userId);
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.currentWinner != address(user) && line.currentWinner != address(0));

        uint256 oldWinnerBalance = line.currentWinner.balance;
        uint256 newWinnerBalance = address(user).balance;

        user.pay{value: line.currentPrice + _bidIncrement + diff}(
            address(_auction), abi.encodeWithSelector(_auction.createBid.selector, nftId)
        );

        assert(line.currentWinner.balance == oldWinnerBalance + line.currentPrice);
        assert(address(user).balance == newWinnerBalance - (_bidIncrement + diff));
    }

    function assert_right_user_balance_after_self_outbid(uint8 nftId, uint96 diff, User userId) public payable {
        Account user = getUser(userId);
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.currentWinner == address(user));
        uint256 initialUserBalance = address(user).balance;

        user.pay{value: line.currentPrice + _bidIncrement + diff}(
            address(_auction), abi.encodeWithSelector(_auction.createBid.selector, nftId)
        );

        assert(address(user).balance == initialUserBalance - (_bidIncrement + diff));
    }

    function assert_right_state_on_first_bid(uint8 nftId, uint96 diff, User userId) public payable {
        Account user = getUser(userId);
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.currentWinner == address(0));

        uint256 initialZeroBalance = address(0).balance;
        uint256 initialUserBalance = address(user).balance;
        uint256 initialAuctionBalance = address(_auction).balance;

        assert(_auction.getMinPriceFor(nftId) == _startingPrice);
        user.pay{value: _startingPrice + diff}(
            address(_auction), abi.encodeWithSelector(_auction.createBid.selector, nftId)
        );

        assert(initialZeroBalance == address(0).balance);
        assert(initialUserBalance == address(user).balance + (_startingPrice + diff));
        assert(initialAuctionBalance == address(_auction).balance + (_startingPrice + diff));

        LineState memory newLine = _auction.lineState(nftId);
        assert(newLine.currentWinner == address(user));
        assert(newLine.currentPrice == _startingPrice + diff);
    }

    function assert_right_line_price(uint8 nftId) public view {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        uint96 linePrice = line.currentPrice + _bidIncrement;
        uint96 minPrice = _auction.getMinPriceFor(nftId);
        assert(linePrice == minPrice);
    }
    */

}
