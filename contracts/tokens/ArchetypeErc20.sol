// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRewardToken.sol";
import "../interfaces/ISharesHolder.sol";


error MintLocked();
error OwnerMintLocked();
error MaxSupplyLocked();
error SharesHolderLocked();
error NotAMinter(address triedToMint);
error MaxRewardsExceded();

struct Config {
	uint256 maxSupply;
    address sharesHolder;
	bool mintLocked;
	bool ownerMintLocked;
    bool maxSupplyLocked;
    bool sharesHolderLocked;
}

contract ArchetypeERC20 is Ownable, ERC20, IRewardToken {
    
    Config config;
    mapping (address => bool) private _isRewardsMinter;

	/*****************************************************\
	|* Contract Initialization And Configuration Methods *|
	\*****************************************************/
	constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

	function setMaxSupply(uint256 maxSupply) public onlyOwner {
        if (config.maxSupplyLocked) revert MaxSupplyLocked();
        require(maxSupply >= totalSupply(), "Max supply can't be below current supply");
		config.maxSupply = maxSupply;
	}
	
	/********************\
	|* Minting  Methods *|
	\********************/
	function _mint(address account, uint256 amount) internal virtual override {
		if (config.mintLocked) revert MintLocked();
		super._mint(account, amount);
	}

	function ownerMint(address account, uint256 amount) public onlyOwner {
		if (config.ownerMintLocked) revert OwnerMintLocked();
        _mint(account, amount);
	}

	/*******************************\
	|* IRewardToken implementation *|
	\*******************************/
    function mintRewards(address account, uint256 amount) external {
        if (!_isRewardsMinter[msg.sender]) revert NotAMinter(msg.sender);
        if (amount > supplyLeft()) revert MaxRewardsExceded();
        _mint(account, amount);
    }

    function isRewardsMinter(address minter) public view returns (bool) {
        return _isRewardsMinter[minter];
    }

    function addRewardsMinter(address minter) external onlyOwner {
        _isRewardsMinter[minter] = true;
    }

    function removeRewardsMinter(address minter) external onlyOwner {
        _isRewardsMinter[minter] = false;
    }

    function supplyLeft() public view returns (uint256) {
        return totalSupply() > config.maxSupply ?
            0 : config.maxSupply - totalSupply();  
    }

    /**********************************\
    |* Simple auctioncore integration *|
    \**********************************/
    function setSharesHolder(address sharesHolder) external onlyOwner {
        if (config.sharesHolderLocked) revert SharesHolderLocked();
        config.sharesHolder = sharesHolder;
    }

    function claimShares() external {
        uint256 shares = ISharesHolder(config.sharesHolder).getAndClearSharesFor(msg.sender);
        if (shares > supplyLeft()) revert MaxRewardsExceded();
        _mint(msg.sender, shares);
    }

    /**************************\
    |* Contract configuration *|
    \**************************/
    function lockMintsForever() external onlyOwner {
        config.mintLocked = true; 
    }

    function lockOwnerMintsForever() external onlyOwner {
        config.ownerMintLocked = true; 
    }

    function lockMaxSupplyForever() external onlyOwner {
        config.maxSupplyLocked = true; 
    }

    function lockSharesHolderForever() external onlyOwner {
        config.sharesHolderLocked = true; 
    }

}
