// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "./ParallelAutoAuction.sol";
import "./interfaces/ISharesHolder.sol";

contract RewardedParallelAuction is ParallelAutoAuction, ISharesHolder {

	/**
     * @dev Amount of eth bidded by an address.
     */
    mapping(address => uint256) private _rewardTokenShares;
	mapping(address => bool) private _allowSharesUpdate;

    bool sharesUpdaterUpdatingLocked;

    function createBid(uint24 nftId) override public payable {
		super.createBid(nftId);
		_rewardTokenShares[msg.sender] += msg.value;
	}
	
	function getAndClearSharesFor(address user) external returns (uint256 shares) {
		require( _allowSharesUpdate[msg.sender]);
		shares = _rewardTokenShares[user];
		delete _rewardTokenShares[user];
	}

	function addSharesUpdater(address updater) external onlyOwner {
        require(!sharesUpdaterUpdatingLocked);
		_allowSharesUpdate[updater] = true;
	}

	function removeSharesUpdater(address updater) external onlyOwner {
        require(!sharesUpdaterUpdatingLocked);
		_allowSharesUpdate[updater] = false;
	}

	function getIsSharesUpdater(address updater) external view returns (bool) {
		return _allowSharesUpdate[updater];
	}

	function getTokenShares(address user) external view returns (uint256) {
		return _rewardTokenShares[user];
	}

    function lockSharesUpdaterUpdatingForever() external onlyOwner {
        sharesUpdaterUpdatingLocked = true;
    }

}
