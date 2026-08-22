import numpy as np
from insightface.app import FaceAnalysis


class FaceRecognizer:

    def __init__(self):

        print("Initializing Face Recognition...")

        self.app = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"]
        )

        self.app.prepare(
            ctx_id=-1,
            det_size=(320, 320)
        )

        print("Face Recognition Ready!")

    def get_faces(self, frame):
        """
        Detect all faces in a frame
        and return their InsightFace objects.
        """

        faces = self.app.get(frame)

        return faces

    def get_embedding(self, frame):
        """
        Get the embedding of a single face.

        Used during face registration.
        """

        faces = self.get_faces(frame)

        if not faces:
            return None

        # If multiple faces are visible,
        # choose the largest face.
        face = max(
            faces,
            key=lambda f: (
                (f.bbox[2] - f.bbox[0])
                *
                (f.bbox[3] - f.bbox[1])
            )
        )

        return face.embedding

    @staticmethod
    def cosine_similarity(
        embedding1,
        embedding2
    ):
        """
        Calculate cosine similarity between
        two face embeddings.
        """

        embedding1 = np.asarray(
            embedding1,
            dtype=np.float32
        )

        embedding2 = np.asarray(
            embedding2,
            dtype=np.float32
        )

        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        similarity = (
            np.dot(embedding1, embedding2)
            / (norm1 * norm2)
        )

        return float(similarity)

    def find_best_match(
        self,
        embedding,
        database,
        threshold=0.45
    ):
        """
        Compare an embedding with all registered
        people and return the best match.
        """

        best_match = None
        best_score = -1.0

        for student_id, person in database.items():

            stored_embedding = np.asarray(
                person["embedding"],
                dtype=np.float32
            )

            score = self.cosine_similarity(
                embedding,
                stored_embedding
            )

            if score > best_score:

                best_score = score

                best_match = {
                    "student_id": student_id,
                    "name": person["name"],
                    "score": score
                }

        # Database is empty
        if best_match is None:
            return None

        # Below threshold = Unknown
        if best_match["score"] < threshold:
            return None

        return best_match