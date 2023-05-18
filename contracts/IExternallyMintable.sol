// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

interface IExternallyMintable {
    /**
     * @dev Allows the minter to mint a NFT to itself.
     */
    function mint() external returns (uint256 tokenId);
    
    /**
     * @dev Sets a `minter` so it can use the `mint` method.
     */
    function setMinter(address minter) external;

    /**
     * @return If `minter` is allowed to call the `mint` function.
     */
    function isMinter(address minter) external returns (bool);
}

