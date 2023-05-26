// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "solady/src/utils/SafeTransferLib.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IExternallyMintable.sol";

error WrongContractConfig();
error AuctionNotStarted();
error AuctionEnded();
error WrongTokenId();
error WrongBidAmount();
error TimeTravelerError();

contract ScatterAuction is Ownable {
    
    struct AuctionState {
        address auctionedNft;
        // The minimum price accepted in an auction.
        uint96 startingPrice;
        // The minimum bid increment.
        uint96 bidIncrement;
        // The start time of the auction.
        uint40 startTime;
        // The end time of the auction.
        uint40 endTime;
        // The minimum amount of time left in an auction after a new bid is created.
        uint32 timeBuffer;
    }
    
    AuctionState public auctionState;
    
    // Last bidded amount for an token id.
    mapping (uint24 => uint96) public lastBidAmount;
    // Extra auction end time for an token id, based on `timeBuffer`.
    mapping (uint24 => uint40) public extraAuctionTime;
    // Current winner of an auction.
    mapping(uint24 => address) public currentWinner;

    constructor(
        address nftToAuction,
        uint96 startingPrice,
        uint96 bidIncrement,
        uint40 startTime,
        uint40 endTime,
        uint32 timeBuffer
    ) {
        if (startTime >= endTime || block.timestamp > startTime)
            revert TimeTravelerError();

        auctionState.auctionedNft = nftToAuction;
        auctionState.startingPrice = startingPrice;
        auctionState.bidIncrement = bidIncrement;
        auctionState.startTime = startTime;
        auctionState.endTime = endTime;
        auctionState.timeBuffer = timeBuffer;
    }

    function createBid(uint24 tokenId) public payable virtual onlyOwner {
        IExternallyMintable token = IExternallyMintable(auctionState.auctionedNft);

        if (!token.isMinter(address(this))) revert WrongContractConfig();
        if (block.timestamp < auctionState.startTime) revert AuctionNotStarted();
        if (auctionHasEnded(tokenId)) revert AuctionEnded();
        if (tokenId < 1 || tokenId > token.maxSupply()) revert WrongTokenId();
        
        if (!rightBid(tokenId, uint96(msg.value))) revert WrongBidAmount();
        
        // Save the last bid amount to refund it later.
        uint96 refundAmount = lastBidAmount[tokenId];
        lastBidAmount[tokenId] = uint96(msg.value);
        
        // Save the last bidder to know who to refund later.
        address lastBidder = currentWinner[tokenId];
        currentWinner[tokenId] = msg.sender;

        if (shouldExtendAuctionEndTime(tokenId)) 
            extraAuctionTime[tokenId] = getNewExtraAuctionTime(tokenId);
        
        // Refund the last bidder.
        SafeTransferLib.forceSafeTransferETH(lastBidder, refundAmount);
    }

    function claimTokens(uint24[] calldata ids) public {
        IExternallyMintable token = IExternallyMintable(auctionState.auctionedNft);
        for (uint24 i = 0; i < ids.length; i++) {
            if (!auctionHasEnded(ids[i]) || currentWinner[ids[i]] == address(0))
                revert WrongTokenId();
            token.mint(ids[i], currentWinner[ids[i]]);
        }
    }
    
    function rightBid(uint24 forTokenId, uint96 bidAmount) public view returns (bool) {
        // If its the first bid, the bid is right if its above the starting price.
        if (lastBidAmount[forTokenId] == 0) 
            return bidAmount >= auctionState.startingPrice;
        return bidAmount >= lastBidAmount[forTokenId] + auctionState.bidIncrement;
    }

    function auctionHasEnded(uint24 forTokenId) public view returns (bool) {
        return block.timestamp > auctionState.endTime + extraAuctionTime[forTokenId];
    }
    
    /**
     * @return An updated extra time for `forTokenId` if the auction should get extended.
     * If not, don't update it at all.
     */
    function getNewExtraAuctionTime(uint24 forTokenId) public view returns (uint40) {
        if (!shouldExtendAuctionEndTime(forTokenId)) 
            return extraAuctionTime[forTokenId];
        return extraAuctionTime[forTokenId] + auctionState.timeBuffer;
    }

    /**
     * @return If the auction time should be extended assuming a bid was made.
     */
    function shouldExtendAuctionEndTime(uint24 forTokenId) public view returns (bool) {
        return auctionState.timeBuffer >= block.timestamp - getCurrentAuctionEndTime(forTokenId);
    }
    
    function getCurrentAuctionEndTime(uint24 forTokenId) public view returns (uint40) {
        return auctionState.endTime + extraAuctionTime[forTokenId];
    }

}

