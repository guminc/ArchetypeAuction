// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./IExternallyMintable.sol";

error WrongTokenId();
error WrongBidAmount();
error AuctionPaused();

contract ParallelAutoAuction {
    
    struct AuctionConfig {
        address auctionedNft;
        /**
         * @notice The number of auctions that can happen at the same time. For
         * example, if `lines == 3`, those will be the auctioned token ids over
         * time:
         *
         * --- TIME --->
         * 
         *  line 1: |--- 1 ---|---- 4 ----|--- 7 ---|---- 10 ---- ...
         *  line 2: |-- 2 --|----- 5 -----|-- 8 --|---- 11 ---- ...
         *  line 3: |---- 3 ----|-- 6 --|---- 9 ----|----- 12 ----- ...
         *
         * Then, from the front-end, you only need to call `lineToState[l].head`
         * to query the current auctioned nft at line `l`. For example, in the
         * graph above, `lineToState[2].head == 11`.
         */
        uint8 lines;
        // @notice The base duration is the time that takes a single auction
        // without considering time buffering.
        uint32 baseDuration;
        // @notice Extra auction time if a bid happens close to the auction end.
        uint32 timeBuffer;
        // @notice The minimum price accepted in an auction.
        uint96 startingPrice;
        // @notice The minimum bid increment.
        uint96 bidIncrement;
    }
    
    /**
     * @dev LineState represents a single auction line, so there will be
     * exactly `auctionConfig.lines` LineStates.
     */
    struct LineState {
        // @notice head Is the current auctioned token id at the line.
        uint24 head;
        uint40 startTime;
        uint40 endTime;
        address currentWinner;
        uint96 currentPrice;
    }

    // @notice The config for the auction should be immutable.
    AuctionConfig public auctionConfig;

    // @notice `lineToState[i]` should only be mutable from the line `i`. 
    mapping(uint8 => LineState) public lineToState;

    constructor(
        address nftToAuction,
        uint8 lines,
        uint32 baseDuration,
        uint32 timeBuffer,
        uint96 startingPrice,
        uint96 bidIncrement
    ) {
        auctionConfig.auctionedNft = nftToAuction;
        auctionConfig.lines = lines;
        auctionConfig.baseDuration = baseDuration;
        auctionConfig.timeBuffer = timeBuffer;
        auctionConfig.startingPrice = startingPrice;
        auctionConfig.bidIncrement = bidIncrement;
    }

    /**
     * @dev Create a bid for a NFT, with a given amount.
     * This contract only accepts payment in ETH.
     */
    function createBid(uint24 nftId) public payable virtual {
        
        uint8 lineNumber = uint8(nftId % auctionConfig.lines);
        LineState storage line = lineToState[lineNumber];
        bool lastLineAuctionEnded = block.timestamp > line.endTime;
        IExternallyMintable token = IExternallyMintable(auctionConfig.auctionedNft);
        
        if (!token.isMinter(address(this)))
            revert AuctionPaused();

        /* ---------- AUCTION UPDATING AND SETTLEMENT ---------- */
        if (lastLineAuctionEnded && !token.exists(line.head) && line.head > 0)
            _settleAuction(line);
        
        if (line.head == 0 || lastLineAuctionEnded)
            _updateLine(line, lineNumber);

        if (line.head != nftId || nftId > token.maxSupply())
            revert WrongTokenId();
        
        /* ------------------ BIDDING LOGIC ------------------ */
        if (
            (line.currentPrice == 0 && msg.value < auctionConfig.startingPrice) ||
            line.currentPrice + auctionConfig.bidIncrement > msg.value
        ) revert WrongBidAmount();

        if (line.currentPrice != 0)
            payable(line.currentWinner).transfer(line.currentPrice);

        line.currentPrice = uint96(msg.value);
        line.currentWinner = msg.sender;
        
        uint40 extendedTime = uint40(block.timestamp + auctionConfig.timeBuffer);
        if (extendedTime > line.endTime)
            line.endTime = extendedTime;

    }

    function settleAuction(uint24 nftId) external {
        LineState memory line = lineToState[uint8(nftId % auctionConfig.lines)];
        IExternallyMintable token = IExternallyMintable(auctionConfig.auctionedNft);
        require(block.timestamp > line.endTime, "Auction still ongoing.");
        require(line.head != 0, "Auction not started.");
        require(!token.exists(nftId), "Token already settled.");
        _settleAuction(line);
    }

    function _settleAuction(LineState memory line) private {
        address nftContract = auctionConfig.auctionedNft;
        IExternallyMintable(nftContract).mint(line.head, line.currentWinner);
        payable(nftContract).transfer(line.currentPrice);
    }
    
    /**
     * @dev `line.head` will be the current token id auctioned at the
     * `line`. If is the first auction for this line (if `line.head == 0`)
     * then the token id should be the line number itself. Otherwise
     * increment the id by the number of lines. For more info about the 
     * second case check the `AuctionConfig.lines` doc.
     * @notice This function should be the only one allowed to change
     * `line.startTime`, `line.endTime` and `line.head` state, and it should
     * do so only when the dev is sure thats its time to auction the next
     * token id.
     */
    function _updateLine(LineState storage line, uint8 lineNumber) private {
        line.startTime = uint40(block.timestamp);
        line.endTime = uint40(block.timestamp + auctionConfig.baseDuration);
        line.head += line.head == 0 ? lineNumber : auctionConfig.lines;
        line.currentPrice = 0;
    }

    /* -- HELPER VIEW FUNCTIONS -- */
    /**
     * @return An array with all the token ids that can currently get auctioned.
     */
    function getIdsToAuction() public view returns (uint24[] memory) {
        uint24[] memory ids = new uint24[](auctionConfig.lines);
        for (uint8 i = 0; i < auctionConfig.lines; i++) {
            LineState memory line = lineToState[i+1];
            uint24 lineId = line.head;
            if (lineId == 0) lineId = i + 1;
            else if (block.timestamp > line.endTime) lineId += auctionConfig.lines;
            ids[i] = lineId;
        }
        return ids;
    }
    
    /**
     * @return The current minimum bid price for an `tokenId`.
     */
    function getMinPriceFor(uint24 tokenId) public view returns (uint96) {
        uint8 lineNumber = uint8(tokenId % auctionConfig.lines);
        LineState memory line = lineToState[lineNumber];
        if (block.timestamp > line.endTime) return auctionConfig.startingPrice;
        else return line.currentPrice + auctionConfig.bidIncrement;
    }

}

