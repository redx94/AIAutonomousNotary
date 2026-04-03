import { createPublicClient, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { CONTRACTS, DOCUMENT_REGISTRY_ABI } from '@/lib/contracts';
import { formatAddress } from '@/lib/utils';

interface DocumentRecord {
  documentHash: `0x${string}`;
  notaryAddress: `0x${string}`;
  timestamp: bigint;
  documentType: string;
  ipfsHash: string;
  isValid: boolean;
}

async function fetchDocument(tokenId: string): Promise<DocumentRecord | null> {
  const chain = process.env.NEXT_PUBLIC_CHAIN_ID === '1' ? mainnet : sepolia;
  const client = createPublicClient({
    chain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL),
  });

  try {
    const data = await client.readContract({
      address: CONTRACTS.DocumentRegistry as `0x${string}`,
      abi: DOCUMENT_REGISTRY_ABI,
      functionName: 'getDocumentByTokenId',
      args: [BigInt(tokenId)],
    });
    return data as DocumentRecord;
  } catch {
    return null;
  }
}

export default async function VerifyPage({ params }: { params: { tokenId: string } }) {
  const doc = await fetchDocument(params.tokenId);
  const isVerified = doc !== null && doc.isValid;

  return (
    <div className="bg-hero min-h-screen pt-24 px-4 pb-16">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white mb-2">Document Verification</h1>
          <p className="text-slate-400">Token ID #{params.tokenId}</p>
        </div>

        {doc ? (
          <div className="glass-card p-8 space-y-6">
            {/* Verification badge */}
            <div className="flex justify-center">
              {isVerified ? (
                <div className="badge-verified text-base px-6 py-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                  VERIFIED
                </div>
              ) : (
                <div className="badge-invalid text-base px-6 py-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  INVALID
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-6 space-y-4">
              <InfoRow
                label="Document Hash"
                value={doc.documentHash}
                mono
                copyable
              />
              <InfoRow
                label="Notary Address"
                value={formatAddress(doc.notaryAddress)}
                mono
                copyable
                fullValue={doc.notaryAddress}
              />
              <InfoRow
                label="Document Type"
                value={doc.documentType || 'Unknown'}
              />
              <InfoRow
                label="Notarized At"
                value={new Date(Number(doc.timestamp) * 1000).toLocaleString()}
              />
              {doc.ipfsHash && (
                <InfoRow
                  label="IPFS Record"
                  value={doc.ipfsHash}
                  mono
                  link={`https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`}
                />
              )}
            </div>

            <div className="border-t border-white/10 pt-6 flex gap-4">
              <a
                href={`https://${process.env.NEXT_PUBLIC_CHAIN_ID === '1' ? '' : 'sepolia.'}etherscan.io/token/${CONTRACTS.NotaryNFT}?a=${params.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm flex-1 text-center"
              >
                View on Etherscan ↗
              </a>
              <a
                href={`https://opensea.io/assets/${CONTRACTS.NotaryNFT}/${params.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm flex-1 text-center"
              >
                View on OpenSea ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <div className="badge-invalid mb-4 mx-auto w-fit">DOCUMENT NOT FOUND</div>
            <p className="text-slate-400">
              Token ID <span className="text-white font-mono">#{params.tokenId}</span> does not
              exist on-chain or the record is invalid.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  copyable,
  fullValue,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  fullValue?: string;
  link?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm text-cyan-400 hover:text-cyan-300 truncate max-w-xs ${mono ? 'font-mono' : ''}`}
          >
            {value}
          </a>
        ) : (
          <span
            className={`text-sm text-white truncate max-w-xs ${mono ? 'font-mono' : ''}`}
            title={fullValue ?? value}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
