
export const ProjectState = {
    isIndexed: false,

    setIndexed(status) {
        this.isIndexed = status;
    },

    isReady() {
        return this.isIndexed;
    }
};
