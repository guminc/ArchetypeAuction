// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./ParallelAutoAuction.sol";
import "./interfaces/ISharesHolder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";


error OwnershipError(address ofToken);

struct Options {
    bool sharesUpdaterUpdatingLocked;
    bool vipRequiredTokenLocked;
    bool vipIdsLocked;
}


contract FigmataAuction is ParallelAutoAuction, ISharesHolder {

    mapping(address => uint256) private _rewardTokenShares;
	mapping(address => bool) private _allowSharesUpdate;
    mapping(uint24 => bool) private _tokenIdIsVip;

    address public tokenRequiredToOwnToBeVip;

    Options public options;

    function createBid(uint24 nftId) override public payable {
        if (
            _tokenIdIsVip[nftId] &&
            IERC721(tokenRequiredToOwnToBeVip).balanceOf(msg.sender) < 1
        ) revert OwnershipError(tokenRequiredToOwnToBeVip);

		super.createBid(nftId);
		_rewardTokenShares[msg.sender] += msg.value;
	}

    /* ----------------------- *\
    |* Vip token configuration *|
    \* ----------------------- */
    function setVipIds(uint24[] memory ids, bool areVip) external onlyOwner {
        if (options.vipIdsLocked) revert OptionLocked();
        for (uint256 i = 0; i < ids.length; i++) _tokenIdIsVip[ids[i]] = areVip;
    }

    function isVipId(uint24 id) external view returns (bool) {
        return _tokenIdIsVip[id];
    }

    function setTokenRequiredToHoldToBeVip(address token) external onlyOwner {
        if (options.vipRequiredTokenLocked) revert OptionLocked(); 
        tokenRequiredToOwnToBeVip = token;
    }

    /* ---------------------------- *\
    |* ISharesHolder implementation *|
    \* ---------------------------- */
	function getAndClearSharesFor(address user) external returns (uint256 shares) {
		require(_allowSharesUpdate[msg.sender]);
		shares = _rewardTokenShares[user];
		delete _rewardTokenShares[user];
	}

	function addSharesUpdater(address updater) external onlyOwner {
        if (options.sharesUpdaterUpdatingLocked) revert OptionLocked();
		_allowSharesUpdate[updater] = true;
	}

	function removeSharesUpdater(address updater) external onlyOwner {
        if (options.sharesUpdaterUpdatingLocked) revert OptionLocked();
		_allowSharesUpdate[updater] = false;
	}

	function getIsSharesUpdater(address updater) external view returns (bool) {
		return _allowSharesUpdate[updater];
	}

	function getTokenShares(address user) external view returns (uint256) {
		return _rewardTokenShares[user];
	}

    /* ---------------------------------- *\
    |* Contract locking and configuration *|
    \* ---------------------------------- */
    function lockSharesUpdaterUpdatingForever() external onlyOwner {
        options.sharesUpdaterUpdatingLocked = true;
    }
    
    function lockTokenRequiredToHoldToBeVipForever() external onlyOwner {
        options.vipRequiredTokenLocked = true;
    }

    function lockVipIdsForever() external onlyOwner {
        options.vipIdsLocked = true;
    }

}
