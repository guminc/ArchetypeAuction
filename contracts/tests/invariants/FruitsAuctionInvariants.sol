// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../FruitsRemiliaAuction.sol";
import "../../tokens/FruitsMilady.sol";
import "../../tokens/Kagami.sol";
import "./Account.sol";
import "solady/src/utils/SafeTransferLib.sol";

contract FruitsAuctionInvariants {

    FruitsMilady private _token;
    Config private _tokenConfig;
    FruitsRemiliaAuction private _auction;
    Kagami private _reward;

    uint96 private _startingPrice = 0.1 ether;
    uint96 private _bidIncrement = 0.1 ether;
    uint8 private _maxId = 254;
    uint256 private _sharesPerBid = 3141592;
    
    uint256 private _startingTime;
    uint32 private _auctionDuration = 86400;
    uint32 private _timeIncrement = 500;

    Account private _user1 = new Account();
    Account private _user2 = new Account();
    Account private _user3 = new Account();

    enum User { USER1, USER2, USER3 }

    constructor() payable {
        _tokenConfig = Config("", address(0), address(0), _maxId, 500);
        _token = new FruitsMilady("FRUiTS MiLADY", "FRUITSMILADY", _tokenConfig);

        _auction = new FruitsRemiliaAuction();

        _auction.initialize(
            address(_token),
            _maxId,
            _auctionDuration,
            _timeIncrement,
            _startingPrice,
            _bidIncrement
        );
        _token.addMinter(address(_auction));
        _token.setMaxSupply(_maxId);

        _auction.setSharesPerBid(_sharesPerBid);

        uint256 bal = address(this).balance/3;
        SafeTransferLib.forceSafeTransferETH(address(_user1), bal);
        SafeTransferLib.forceSafeTransferETH(address(_user2), bal);
        SafeTransferLib.forceSafeTransferETH(address(_user3), bal);

        _reward = new Kagami("Kagami", "KAGAMI");
        _reward.setMaxSupply(1000000 ether);
        _reward.setSharesHolder(address(_auction));
        _auction.addSharesUpdater(address(_reward));

        _startingTime = block.timestamp;

        // _auction.renounceOwnership();
        // _token.renounceOwnership();
    }
    
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
    }

    function assert_cant_settle_before_auction_duration(uint24 nftId) public {
        require(block.timestamp < _startingTime + _auctionDuration);
        _auction.settleAuction(nftId);
        assert(false);
    }

    function assert_can_settle_after_auction_duration(uint8 nftId) public {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.head > _maxId);
        require(!_token.exists(nftId));

        uint256 initialAuctionBalance = address(_auction).balance;
        uint256 initialTokenBalance = address(_token).balance;

        _auction.settleAuction(nftId);

        assert(address(_auction).balance + _startingPrice <= initialAuctionBalance);
        assert(address(_token).balance == initialTokenBalance + (initialAuctionBalance - address(_auction).balance));
    }

    function assert_cant_never_settle_before_auction_end(uint8 nftId) public {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);

        require(line.head == nftId);
        _auction.settleAuction(nftId);
        assert(false);
    }

    function assert_time_extension(uint8 nftId, uint96 diff, User userId) public {
        Account user = getUser(userId);
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);

        require(line.endTime - block.timestamp < _timeIncrement);
        assert(line.head == nftId);

        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            line.currentPrice + _bidIncrement + diff
        );

        LineState memory newLine = _auction.lineState(nftId);

        assert(newLine.endTime == line.endTime + _timeIncrement);
        assert(newLine.head == nftId);
    }


    function assert_nft_balance_null() public view {
        LineState[] memory lines = _auction.lineStates();

        for (uint256 i = 0; i < lines.length; i++) {
            require(lines[i].endTime > block.timestamp);
            require(lines[i].head <= _maxId);
        }

        assert(address(_token).balance == 0); 
    }

    function assert_cant_bid_with_ids_out_of_range(uint24 nftId, uint96 diff) public payable {
        require(nftId == 0 || nftId > _maxId);
        uint96 currentPrice = _auction.getMinPriceFor(nftId);
        _auction.createBid{value: currentPrice + diff}(nftId);
        assert(false);
    }

    function assert_cant_start_out_of_range_line(uint24 nftId, uint96 diff) public {
        require(nftId > _maxId);
        LineState memory line = _auction.lineState(nftId);
        require(line.head > _maxId);
        _auction.createBid{value: _startingPrice + diff}(nftId);
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
        
        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            oldLine.currentPrice + _bidIncrement + diff
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

        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            currentPrice + diff
        );

        assert(_auction.getTokenShares(address(user)) == currentShares + _auction.getSharesPerBid());
    }

    function assert_contract_balance_ge_line_balance(uint8 nftId) public view {
        require(nftId > 0 && nftId <= _maxId);
        LineState memory line = _auction.lineState(nftId);
        assert(address(_auction).balance >= line.currentPrice);
    }

    function assert_right_total_auction_balance() public view {
        require(block.timestamp < _startingTime + _auctionDuration);
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

        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            line.currentPrice + _bidIncrement + diff
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

        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            line.currentPrice + _bidIncrement + diff
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
        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            _startingPrice + diff
        );

        assert(initialZeroBalance == address(0).balance);
        assert(initialUserBalance == address(user).balance + (_startingPrice + diff));
        assert(initialAuctionBalance == address(_auction).balance - (_startingPrice + diff));

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

    function assert_right_line_price_after_bid(uint8 nftId, uint96 diff, User userId) public {
        Account user = getUser(userId);
        uint96 minPrice = _auction.getMinPriceFor(nftId);
        require(uint256(minPrice) + uint256(diff) < 2**96);

        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            minPrice + diff
        );

        LineState memory line = _auction.lineState(nftId);
        assert(line.currentPrice == minPrice + diff);
        assert(line.currentPrice == _auction.getMinPriceFor(nftId) - _bidIncrement);
    }

    function can_claim_reward_token(uint8 nftId, uint96 diff, User userId) public {
        Account user = getUser(userId);
        uint96 minPrice = _auction.getMinPriceFor(nftId);

        uint256 initialRewardTokenBalance = _reward.balanceOf(address(user));
        uint256 initialShares = _auction.getTokenShares(address(user));

        user.pay(
            address(_auction),
            abi.encodeCall(_auction.createBid, nftId),
            minPrice + diff
        );

        assert(initialRewardTokenBalance == _reward.balanceOf(address(user)));
        user.proxy(address(_reward), abi.encodeCall(_reward.claimShares, ()));
        
        uint256 expectedBal = initialRewardTokenBalance + _sharesPerBid + initialShares;
        assert(expectedBal == _reward.balanceOf(address(user)));
        user.proxy(address(_reward), abi.encodeCall(_reward.claimShares, ()));
        assert(expectedBal == _reward.balanceOf(address(user)));
    }

}
