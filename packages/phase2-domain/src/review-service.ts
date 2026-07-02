// @ts-check

/**
 * @param {import("../../persistence/src/repositories.ts").ReviewRepository} reviewRepository
 * @param {import("./types.ts").ReviewQueueItem} item
 */
async function createReviewItem(reviewRepository, item) {
  return reviewRepository.createReviewItem(item);
}

/**
 * @param {import("../../persistence/src/repositories.ts").ReviewRepository} reviewRepository
 * @param {string} id
 * @param {"approved" | "rejected" | "skipped"} status
 * @param {string=} note
 */
async function updateReviewStatus(reviewRepository, id, status, note = "") {
  return reviewRepository.updateReviewDecision(id, {
    review_status: status,
    review_notes: note,
  });
}

module.exports = {
  createReviewItem,
  updateReviewStatus,
};
