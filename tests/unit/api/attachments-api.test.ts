import { beforeEach, describe, expect, it } from "vitest";

import { Route as InitiateRoute } from "../../../src/routes/api/v1/attachments/initiate";
import { Route as AttachmentIdRoute } from "../../../src/routes/api/v1/attachments/$attachmentId";
import { Route as MetaRoute } from "../../../src/routes/api/v1/attachments/$attachmentId/meta";
import { Route as ChunkRoute } from "../../../src/routes/api/v1/attachments/$attachmentId/chunks/$chunkIndex";
import { Route as FinalizeRoute } from "../../../src/routes/api/v1/attachments/$attachmentId/finalize";

import { getApiContext, setApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  computeAttachmentCommitment,
  computeChunkHash,
} from "../../../src/services/crypto/attachment-stream";

const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;
const stranger = `G${"C".repeat(55)}`;

describe("Attachments API Routes", () => {
  beforeEach(() => {
    setApiContext({ repository: new MemoryApiRepository() });
  });

  it("handles full attachment lifecycle via API route handlers", async () => {
    const chunk0 = new TextEncoder().encode("Hello ");
    const chunk1 = new TextEncoder().encode("World API");

    const hash0 = await computeChunkHash(chunk0);
    const hash1 = await computeChunkHash(chunk1);

    const commitment = await computeAttachmentCommitment([hash0, hash1], {
      filename: "test.txt",
      contentType: "text/plain",
      size: 15,
    });

    const messageId = "a".repeat(64);

    // 1. INITIATE
    const initiateReq = new Request("http://localhost/api/v1/attachments/initiate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stealth-address": sender,
      },
      body: JSON.stringify({
        messageId,
        sender,
        recipient,
        filename: "test.txt",
        contentType: "text/plain",
        size: 15,
        chunkCount: 2,
        commitment,
      }),
    });

    const initiateRes = await InitiateRoute.options.server!.handlers!.POST!({
      request: initiateReq,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(initiateRes.status).toBe(201);
    const initiateData = await initiateRes.json();
    const attachmentId = initiateData.data.attachmentId;
    expect(attachmentId).toBeDefined();

    // 2. UPLOAD CHUNKS
    const chunk0Req = new Request(`http://localhost/api/v1/attachments/${attachmentId}/chunks/0`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-stealth-address": sender,
      },
      body: JSON.stringify({
        data: btoa("Hello "),
        hash: hash0,
      }),
    });

    const chunk0Res = await ChunkRoute.options.server!.handlers!.PUT!({
      request: chunk0Req,
      params: { attachmentId, chunkIndex: "0" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(chunk0Res.status).toBe(200);

    const chunk1Req = new Request(`http://localhost/api/v1/attachments/${attachmentId}/chunks/1`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-stealth-address": sender,
      },
      body: JSON.stringify({
        data: btoa("World API"),
        hash: hash1,
      }),
    });

    const chunk1Res = await ChunkRoute.options.server!.handlers!.PUT!({
      request: chunk1Req,
      params: { attachmentId, chunkIndex: "1" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(chunk1Res.status).toBe(200);

    // 3. CHECK META
    const metaReq = new Request(`http://localhost/api/v1/attachments/${attachmentId}/meta`, {
      method: "GET",
      headers: {
        "x-stealth-address": recipient,
      },
    });

    const metaRes = await MetaRoute.options.server!.handlers!.GET!({
      request: metaReq,
      params: { attachmentId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(metaRes.status).toBe(200);
    const metaData = await metaRes.json();
    expect(metaData.data.uploadedChunks).toEqual([0, 1]);

    // 4. FINALIZE
    const finalizeReq = new Request(
      `http://localhost/api/v1/attachments/${attachmentId}/finalize`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-stealth-address": sender,
        },
        body: JSON.stringify({ commitment }),
      },
    );

    const finalizeRes = await FinalizeRoute.options.server!.handlers!.POST!({
      request: finalizeReq,
      params: { attachmentId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(finalizeRes.status).toBe(200);

    // 5. AUTHENTICATED DOWNLOAD BY RECIPIENT
    const downloadReq = new Request(`http://localhost/api/v1/attachments/${attachmentId}`, {
      method: "GET",
      headers: {
        "x-stealth-address": recipient,
      },
    });

    const downloadRes = await AttachmentIdRoute.options.server!.handlers!.GET!({
      request: downloadReq,
      params: { attachmentId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(downloadRes.status).toBe(200);
    const downloadedBody = await downloadRes.text();
    expect(downloadedBody).toBe("Hello World API");

    // 6. DOWNLOAD REJECTION FOR STRANGER (403)
    const strangerReq = new Request(`http://localhost/api/v1/attachments/${attachmentId}`, {
      method: "GET",
      headers: {
        "x-stealth-address": stranger,
      },
    });

    const strangerRes = await AttachmentIdRoute.options.server!.handlers!.GET!({
      request: strangerReq,
      params: { attachmentId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(strangerRes.status).toBe(403);
  });
});
