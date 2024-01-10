// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "./AutoAuction.sol";
import "./interfaces/ISharesHolder.sol";

contract RewardedAuction is AutoAuction, ISharesHolder {

	/**
     * @dev Amount of eth bidded by an address.
     */
    mapping(address => uint256) private _rewardTokenShares;
	mapping(address => bool) private _allowSharesUpdate;

    function createBid(uint256 nftId, uint96 amount) override public payable {
		super.createBid(nftId, amount);
		_rewardTokenShares[msg.sender] += msg.value;
	}
	
	function getAndClearSharesFor(address user) external returns (uint256 shares) {
		require(msg.sender == owner() || _allowSharesUpdate[msg.sender]);
		shares = _rewardTokenShares[user];
		delete _rewardTokenShares[user];
	}

	function addSharesUpdater(address updater) external onlyOwner {
		_allowSharesUpdate[updater] = true;
	}

	function removeSharesUpdater(address updater) external onlyOwner {
		_allowSharesUpdate[updater] = false;
	}

	function getIsSharesUpdater(address updater) external view returns (bool) {
		return _allowSharesUpdate[updater];
	}

	function getTokenShares(address user) external view returns (uint256) {
		return _rewardTokenShares[user];
	}

}
