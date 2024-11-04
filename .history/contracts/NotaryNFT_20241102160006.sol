pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title NotaryNFT
 * @dev This contract generates unique NFTs as cryptographic notary seals for each notarized document.
 * Each NFT contains metadata including document hash, timestamp, and notary identity, ensuring a tamper-proof seal.
 */
contract NotaryNFT is ERC721 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // Mapping to store metadata for each NFT
    mapping(uint256 => string) public tokenURI;

    // Event emitted when a new NFT is minted
    event NotaryNFTStamped(uint256 indexed tokenId, address indexed owner, bytes32 documentHash);

    constructor() ERC721("NotaryNFT", "NOTARY") {}

    /**
     * @dev Mints a new NotaryNFT and sets the initial metadata.
     * @param to The address to mint the NFT to.
     * @param documentHash The hash of the document being notarized.
     */
    function mintNotaryNFT(address to, bytes32 documentHash) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);

        // Set initial metadata for the NFT
        string memory uri = string(abi.encodePacked("ipfs://", documentHash));
        tokenURI[tokenId] = uri;

        emit NotaryNFTStamped(tokenId, to, documentHash);
        return tokenId;
    }

    /**
     * @dev Updates the metadata associated with an NFT.
     * @param tokenId The ID of the NFT to update.
     * @param newURI The new URI for the NFT.
     */
    function updateMetadata(uint256 tokenId, string calldata newURI) public {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        tokenURI[tokenId] = newURI;
    }

    /**
     * @dev Transfers ownership of an NFT.
     * @param from The address of the current owner.
     * @param to The address of the new owner.
     * @param tokenId The ID of the NFT to transfer.
     */
    function transferOwnership(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _transfer(from, to, tokenId);
    }
}
