// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IExternallyMintable.sol";

contract MinimalAuctionableNFT is ERC721, Ownable, IExternallyMintable {

    address internal _minter;

	constructor(string memory name, string memory symbol) ERC721(name, symbol) {}
    
    // -- IExternallyMintable realization -- //
    function mint(uint24 tokenId, address to) external onlyMinter {
        _mint(to, tokenId);
    }

    function exists(uint24 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    function setMinter(address minter) external onlyOwner {
        _minter = minter;
    }

    function removeMinter(address minter) external onlyOwner {
        if (minter == _minter) _minter = address(0);
    }

    function isMinter(address minter) external view returns (bool) {
        return minter == _minter; 
    }

    function maxSupply() external pure returns (uint24) {
        return 10000;
    }

    // -- State and helpers -- //
    /**
     * @dev Guards a function such that only the minter is authorized to call it.
     */
    modifier onlyMinter() virtual {
        require(msg.sender == _minter, "Unauthorized minter.");
        _;
    }

	receive() external payable {}

	function withdraw() external onlyOwner {
		payable(msg.sender).transfer(address(this).balance);
	}

	function withdraw(address token) external onlyOwner {
        IERC20(token).transfer(msg.sender, IERC20(token).balanceOf(address(this)));
	}

}
