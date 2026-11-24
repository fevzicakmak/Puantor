const {createHash}=require("node:crypto");
const receiptHash=token=>typeof token==="string"&&/^[A-Za-z0-9_-]{43}$/.test(token)?createHash("sha256").update(token).digest("hex"):null;
function writeReceipt({tx,db,record,status,stamp,expectedCompletionAt}){
 if(!/^[a-f0-9]{64}$/.test(record.receiptHash||""))return;
 tx.set(db.collection("accountDeletionReceipts").doc(record.receiptHash),{status,updatedAt:stamp,...(expectedCompletionAt!==undefined?{expectedCompletionAt}:{}),...(status==="completed"?{completedAt:stamp}:{})},{merge:true});
}
module.exports={receiptHash,writeReceipt};
