// SPDX-License-Identifier: GPL-3.0
// ETYMOLOGY: Zora Auction House -> Noun Auction House -> Bonkler Auction -> Scatter Auction

pragma solidity ^0.8.4;

import "solady/src/utils/SafeTransferLib.sol";
import "solady/src/utils/SafeCastLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ScatterAuction is Ownable {
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           EVENTS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    event AuctionCreated(uint256 indexed nftId, uint256 startTime, uint256 endTime);
    event AuctionBid(uint256 indexed nftId, address bidder, uint256 amount, bool extended);
    event AuctionExtended(uint256 indexed nftId, uint256 endTime);
    event AuctionSettled(uint256 indexed nftId, address winner, uint256 amount);
    event AuctionTimeBufferUpdated(uint256 timeBuffer);
    event AuctionReservePriceUpdated(uint256 reservePrice);
    event AuctionBidIncrementUpdated(uint256 bidIncrement);
    event AuctionDurationUpdated(uint256 duration);
    event AuctionBidTokenUpdated(address token);

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          STORAGE                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @dev A struct containing the auction data and configuration.
     * We bundle as much as possible into a single struct so that we can
     * use a single view function to fetch all the relevant data,
     * helping us reduce RPC calls.
     *
     * Notes:
     *
     * - `uint96` is enough to represent 79,228,162,514 ETH.
     *   Currently, there is only 120,523,060 ETH in existence.
     *
     * - `uint40` is enough to represent timestamps up to year 36811 A.D.
     */
    struct AuctionData {
        // The address of the current highest bid.
        address bidder;
        // Token used for bids, it will be used eth if set to 0
        address bidToken;
        // The current highest bid amount.
        uint96 amount;
        // If `bidToken == address(0)` then `isEthAuction == true`
        bool isEthAuction;
        // The start time of the auction.
        uint40 startTime;
        // The end time of the auction.
        uint40 endTime;
        // ERC721 token ID. Starts from 0.
        uint24 nftId;
        // ERC721 max supply.
        uint24 maxSupply;
        // Whether or not the auction has been settled.
        bool settled;
        // The ERC721 token contract.
        address nftContract;
        // The minimum price accepted in an auction.
        uint96 reservePrice;
        // The minimum bid increment.
        uint96 bidIncrement;
        // The duration of a single auction.
        uint32 duration;
        // The minimum amount of time left in an auction after a new bid is created.
        uint32 timeBuffer;
        // The amount of ETH in the NFT contract.
        // This can be considered as the treasury balance.
        uint256 nftContractBalance;
    }

    /**
     * @dev The auction data.
     */
    AuctionData internal _auctionData;

    
    /**
     * @dev The address that deployed the contract.
     */
    address internal immutable _deployer;

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        CONSTRUCTOR                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    constructor() {
        _deployer = msg.sender;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        INITIALIZER                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function initialize(
        address bidToken,
        address nftContract,
        uint24 maxSupply,
        uint96 reservePrice,
        uint96 bidIncrement,
        uint32 duration,
        uint32 timeBuffer
    ) external payable {
        require(_deployer == msg.sender, "Only the deployer can call.");
        require(nftContract != address(0), "The nft token address can't be 0");
        require(_auctionData.nftContract == address(0), "Already initialized.");
        require(maxSupply > 0, "The token supply can't be 0");

        _checkReservePrice(reservePrice);
        _checkBidIncrement(bidIncrement);
        _checkDuration(duration);
    
        _auctionData.bidToken = bidToken;
        _auctionData.isEthAuction = bidToken == address(0);

        _auctionData.nftContract = nftContract;
        _auctionData.maxSupply = maxSupply;

        _auctionData.reservePrice = reservePrice;
        _auctionData.bidIncrement = bidIncrement;

        _auctionData.duration = duration;
        _auctionData.timeBuffer = timeBuffer;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*              PUBLIC / EXTERNAL VIEW FUNCTIONS              */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @dev Returns all the public data on the auction,
     * with some useful extra information on the NFT.
     */
    function auctionData() external view returns (AuctionData memory data) {
        data = _auctionData;
        // Load some extra data regarding the NFT contract.
        data.nftContractBalance = address(_auctionData.nftContract).balance;
    }

    /**
     * @dev Returns whether the auction has ended.
     */
    function hasEnded() public view returns (bool) {
        return block.timestamp >= _auctionData.endTime;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*              PUBLIC / EXTERNAL WRITE FUNCTIONS             */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @dev Create a bid for a NFT, with a given amount.
     * This contract only accepts payment in ETH.
     * @param biddedAmount Should be 0 if the auction is in eth.
     * The frontend should pass in the next `nftId` when the auction has ended.
     */
    function createBid(uint256 nftId, uint96 biddedAmount) public payable virtual {
        // To prevent gas under-estimation.
        require(gasleft() > 150000);
        
        // TODO analyze code for hyperinflationary tokens
        if (_auctionData.isEthAuction) biddedAmount = SafeCastLib.toUint96(msg.value);
        /* ------- AUTOMATIC AUCTION CREATION AND SETTLEMENT -------- */

        bool creationFailed;
        if (_auctionData.startTime == 0) {
            // If the first auction has not been created,
            // try to create a new auction.
            creationFailed = !_createAuction();
        } else if (hasEnded()) {
            if (_auctionData.settled) {
                // If the auction has ended, and is settled, try to create a new auction.
                creationFailed = !_createAuction();
            } else {
                // Otherwise, if the auction has ended, but is yet been settled, settle it.
                _settleAuction();
                // After settling the auction, try to create a new auction.
                if (!_createAuction()) {
                    // If the creation fails, it means that maxSupply was exceded
                    // In this case, refund all the bidded amount and early return.
                    if (_auctionData.isEthAuction)
                        SafeTransferLib.forceSafeTransferETH(msg.sender, msg.value);
                    return;
                } 
            }
        }

        if (!_auctionData.isEthAuction) IERC20(_auctionData.bidToken).transferFrom(
            msg.sender, address(this), biddedAmount
        );
        // If the auction creation fails, we must revert to prevent any bids.
        require(!creationFailed, "Cannot create auction.");

        /* --------------------- BIDDING LOGIC ---------------------- */

        address lastBidder = _auctionData.bidder;
        uint256 amount = _auctionData.amount; // `uint96`.
        uint256 endTime = _auctionData.endTime; // `uint40`.

        // Ensures that the `nftId` is equal to the auction's.
        // This prevents the following scenarios:
        // - A bidder bids a high price near closing time, the next auction starts,
        //   and the high bid gets accepted as the starting bid for the next auction.
        // - A bidder bids for the next auction due to frontend being ahead of time,
        //   but the current auction gets extended,
        //   and the bid gets accepted for the current auction.
        require(nftId == _auctionData.nftId, "Bid for wrong NFT ID.");
        
        if (amount == 0) {
            require(biddedAmount >= _auctionData.reservePrice, "Bid below reserve price.");
        } else {
            // Won't overflow. `amount` and `bidIncrement` are both stored as 96 bits.
            require(biddedAmount >= amount + _auctionData.bidIncrement, "Bid too low.");
        }

        _auctionData.bidder = msg.sender;
        _auctionData.amount = biddedAmount;

        if (_auctionData.timeBuffer == 0) {
            emit AuctionBid(nftId, msg.sender, biddedAmount, false);
        } else {
            // Extend the auction if the bid was received within `timeBuffer` of the auction end time.
            uint256 extendedTime = block.timestamp + _auctionData.timeBuffer;
            // Whether the current timestamp falls within the time extension buffer period.
            bool extended = endTime < extendedTime;
            emit AuctionBid(nftId, msg.sender, biddedAmount, extended);

            if (extended) {
                _auctionData.endTime = SafeCastLib.toUint40(extendedTime);
                emit AuctionExtended(nftId, extendedTime);
            }
        }

        if (amount != 0) {
            // Refund the last bidder.
            if (_auctionData.isEthAuction)
                SafeTransferLib.forceSafeTransferETH(lastBidder, amount);
            else IERC20(_auctionData.bidToken).transfer(lastBidder, amount);
        }
    }

    /**
     * @dev Settles the auction.
     * This method may be called by anyone if there are no bids to trigger
     * settling the ended auction, or to settle the last auction,
     * when all the generation hash hashes have been used.
     */
    function settleAuction() external {
        require(block.timestamp >= _auctionData.endTime, "Auction still ongoing.");
        require(_auctionData.startTime != 0, "No auction.");
        require(_auctionData.bidder != address(0), "No bids.");
        require(!_auctionData.settled, "Auction already settled.");
        _settleAuction();
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                   ADMIN WRITE FUNCTIONS                    */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @dev Set the auction reserve price.
     */
    function setReservePrice(uint96 reservePrice) external onlyOwner {
        _checkReservePrice(reservePrice);
        _auctionData.reservePrice = reservePrice;
        emit AuctionReservePriceUpdated(reservePrice);
    }

    /**
     * @dev Set the auction bid increment.
     */
    function setBidIncrement(uint96 bidIncrement) external onlyOwner {
        _checkBidIncrement(bidIncrement);
        _auctionData.bidIncrement = bidIncrement;
        emit AuctionBidIncrementUpdated(bidIncrement);
    }

    /**
     * @dev Set the auction time duration in seconds.
     */
    function setDuration(uint32 duration) external onlyOwner {
        _checkDuration(duration);
        _auctionData.duration = duration;
        emit AuctionDurationUpdated(duration);
    }

    /**
     * @dev Set the auction time buffer in seconds.
     */
    function setTimeBuffer(uint32 timeBuffer) external onlyOwner {
        _auctionData.timeBuffer = timeBuffer;
        emit AuctionTimeBufferUpdated(timeBuffer);
    }
    
    /**
     * @dev Set a new token to use for bids.
     */
    function setBidToken(address bidToken) external onlyOwner {
        _auctionData.bidToken = bidToken;
        _auctionData.isEthAuction = bidToken == address(0);
        emit AuctionBidTokenUpdated(bidToken);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                 INTERNAL / PRIVATE HELPERS                 */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @dev Create an auction.
     * Stores the auction details in the `auction` state variable
     * and emits an `AuctionCreated` event.
     * Returns whether the auction has been created successfully.
     */
    function _createAuction() internal returns (bool) {
        uint256 nftId = uint256(_auctionData.nftId) + 1;
    
        if (nftId > _auctionData.maxSupply) return false;

        nftId = IAuctionedNFT(_auctionData.nftContract).mint();
    
        uint256 endTime = block.timestamp + _auctionData.duration;
        
        _auctionData.bidder = address(1);
        _auctionData.amount = 0;
        _auctionData.startTime = SafeCastLib.toUint40(block.timestamp);
        _auctionData.endTime = SafeCastLib.toUint40(endTime);
        _auctionData.nftId = SafeCastLib.toUint24(nftId);
        _auctionData.settled = false;

        emit AuctionCreated(nftId, block.timestamp, endTime);

        return true;
    }

    /**
     * @dev Settle an auction, finalizing the bid.
     */
    function _settleAuction() internal {
        address bidder = _auctionData.bidder;
        uint256 amount = _auctionData.amount;
        uint256 nftId = _auctionData.nftId;
        address nftContract = _auctionData.nftContract;
    
        if (_auctionData.isEthAuction)
            payable(nftContract).transfer(amount);
        else IERC20(_auctionData.bidToken).transfer(nftContract, amount);

        IAuctionedNFT(nftContract).safeTransferFrom(
            address(this), bidder, nftId
        );

        _auctionData.settled = true;

        emit AuctionSettled(nftId, bidder, amount);
    }

    /**
     * @dev Checks whether `reservePrice` is greater than 0.
     */
    function _checkReservePrice(uint96 reservePrice) internal pure {
        require(reservePrice != 0, "Reserve price must be greater than 0.");
    }

    /**
     * @dev Checks whether `bidIncrement` is greater than 0.
     */
    function _checkBidIncrement(uint96 bidIncrement) internal pure {
        require(bidIncrement != 0, "Bid increment must be greater than 0.");
    }

    /**
     * @dev Checks whether `bidIncrement` is greater than 0.
     */
    function _checkDuration(uint32 duration) internal pure {
        require(duration != 0, "Duration must be greater than 0.");
    }
}

interface IAuctionedNFT {

    function safeTransferFrom(address from, address to, uint256 tokenId) external; 

    /**
     * @dev Allows the minter to mint a NFT to itself.
     */
    function mint() external returns (uint256 tokenId);
}

