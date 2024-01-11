// SPDX-License-Identifier: MIT
// Archetype RewardedAuction
//
//        d8888                 888               888
//       d88888                 888               888
//      d88P888                 888               888
//     d88P 888 888d888 .d8888b 88888b.   .d88b.  888888 888  888 88888b.   .d88b.
//    d88P  888 888P"  d88P"    888 "88b d8P  Y8b 888    888  888 888 "88b d8P  Y8b
//   d88P   888 888    888      888  888 88888888 888    888  888 888  888 88888888
//  d8888888888 888    Y88b.    888  888 Y8b.     Y88b.  Y88b 888 888 d88P Y8b.
// d88P     888 888     "Y8888P 888  888  "Y8888   "Y888  "Y88888 88888P"   "Y8888
//                                                            888 888
//                                                       Y8b d88P 888
//                                                        "Y88P"  888

pragma solidity ^0.8.4;

import "./ParallelAutoAuction.sol";
import "./interfaces/ISharesHolder.sol";

contract FruitsRemiliaAuction is ParallelAutoAuction, ISharesHolder {

    /**
     * @dev Amount of rewarded shares per bid.
     */
    uint256 private _sharesPerBid;

    /**
     * @dev Amount of shares owned by an address.
     */
    mapping(address => uint256) private _rewardTokenShares;

    /**
     * @dev Addresses allowed to update the shares. Usually another contract.
     */
    mapping(address => bool) private _allowSharesUpdate;


    function createBid(uint24 nftId) override public payable {
        super.createBid(nftId);
        _rewardTokenShares[msg.sender] += _sharesPerBid;
    }

    function getAndClearSharesFor(address user) external returns (uint256 shares) {
        require(_allowSharesUpdate[msg.sender] || msg.sender == owner());
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

    function setSharesPerBid(uint256 sharesPerBid) external onlyOwner {
        _sharesPerBid = sharesPerBid;
    }

    function getSharesPerBid() external view returns (uint256) {
        return _sharesPerBid;
    }

}
