// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

interface IExternallyMintable {
    /**
     * @dev Allows the minter to mint a NFT to `to`.
     */
    function mint(uint24 tokenId, address to) external;
    
    /**
     * @dev Sets a `minter` so it can use the `mint` method.
     */
    function setMinter(address minter) external;

    /**
     * @dev Disallow `minter` from using the `mint` method.
     */
    function removeMinter(address minter) external;

    /**
     * @return If `minter` is allowed to call the `mint` function.
     */
    function isMinter(address minter) external returns (bool);

    /**
     * @return The max supply of the token, so the auction that will
     * use it knows wheres the mints limit.
     */
    function maxSupply() external returns (uint24);
}

