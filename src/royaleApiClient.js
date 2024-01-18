const undici = require('undici');


class APIClient{
    static BASE_URL = "https://api.cryptoroyale.one/api/royale"

    /**
     * Crypto Royale API Client
     * @param {string} apiKey 
     */
    constructor(apiKey){
        this.authenticationJsonBody = {
            key: apiKey,
        };
    }

    /**
     * Convert permission list to dictionary.
     * @param {Array<{[key: string]: string | boolean}>} permissions 
     * @returns { {[key: string]: boolean} }
     */
    static permissionListToDict(permissions) {
        const permsDict = {};
        for(const perm of permissions){
            permsDict[perm["type"]] = perm["value"];
        }
        return permsDict;
    }

    /**
     * Check how much ROY is in your API wallet. All increments and decrements happen
     * between user wallets and your API wallet. If your API wallet reaches 0, you will
     * not be able to increment user wallets anymore. Your API balance will NOT be immediately
     * withdrawable, to give user's adequate time to report any incorrect charges.
     * @returns {number | null} API wallet balance or null when request fail.
     */
    async balance(){
        const response = await undici.request(`${APIClient.BASE_URL}/balance`, {
            method: 'POST',
            body: JSON.stringify(this.authenticationJsonBody),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const r = await response.body.json();

        if(response.statusCode == 200){
            return r["data"]["balance"];
        } else {
            console.error(r);
            return null;
        }
    }

    /**
     * Check how much ROY is in a user's wallet. Only possible if your API has been 
     * given the userbalance permission by the user.
     * @param {string} discordUserID - Discord ID of the user to check their balance.
     * @returns {number | null} User balance or null when request fail.
     */
    async userBalance(discordUserID){
        const payload = {
            ...this.authenticationJsonBody,
            discordid: discordUserID,
        };

        const response = await undici.request(`${APIClient.BASE_URL}/userbalance`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const r = await response.body.json();
        
        if(response.statusCode == 200){
            return r["data"]["balance"];
        } else {
            console.error(r);
            return null;
        }
    }

    /**
     * Transfer funds from API wallet to user wallet if amount > 0 or the other way around
     * if the provided value is negative. Only possible if your API has been given the 
     * increment / decrement permission by the user.
     * @param {string} discordUserID Discord ID of the user to perform operation on.
     * @param {number} amount Amount of ROY transfered in a transaction.
     * @param {string} reason Reason for transaction. Shows up in transactions prefixed by your app's initials.
     * @param {string} nonce Transaction ID that will be assign to the executed transaction, required unique value by API.
     *                       If not provided, APIClient will generate UUID.
     * @returns {bool} Returns true if transaction was successful.
     */
    async transaction(discordUserID, amount, reason, nonce){
        const action = amount > 0 ? 'increment' : 'decrement';

        nonce = nonce || crypto.randomUUID();
        const payload = {
            ...this.authenticationJsonBody,
            discordid: discordUserID,
            amount: Math.abs(amount),
            reason: reason,
            nonce: nonce,
        };

        console.log(payload);

        const response = await undici.request(`${APIClient.BASE_URL}/${action}`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if(response.statusCode == 200){
            return true;
        } else {
            console.error(await response.body.json())
            return false;
        }
    }

    /**
     * Transfer funds from API wallet to user wallet. Only possible if your API has been
     * given the increment permission by the user.
     * @param {string} discordUserID Discord ID of the user to whom the amount will be sent.
     * @param {number} amount Amount of ROY that the user will receive from API wallet balance.
     * @param {string} reason Reason for increment. Shows up in transactions prefixed by your app's initials.
     * @param {string} nonce Transaction ID that will be assign to the executed transaction, required unique value by API.
     *                       If not provided, APIClient will generate UUID.
     * @returns {bool} Returns true if transaction was successful.
     */
    async increment(discordUserID, amount, reason, nonce){
        return await this.transaction(discordUserID, amount, reason, nonce);
    }

    /**
     * Transfer funds from user wallet to API wallet. Transfer funds from user wallet to API wallet.
     * Only possible if your API has been given the decrement permission by the user.
     * @param {string} discordUserID Discord ID of the user from whom the amount will be taken.
     * @param {number} amount Amount of ROY to deduct from user.
     * @param {string} reason Reason for deduction. Shows up in transactions prefixed by your app's initials.
     * @param {string} nonce Transaction ID that will be assign to the executed transaction, required unique value by API.
     *                       If not provided, APIClient will generate UUID.
     * @returns {bool} Returns true if transaction was successful.
     */
    async decrement(discordUserID, amount, reason, nonce){
        return await this.transaction(discordUserID, -amount, reason, nonce);
    }

    /**
     * Check which permissions your app has been given, by a specific user.
     * Ideally your app should degrade its UX gracefully, if less permissions are given than expected.
     * For example, do not show a user's balance in your own app if the balance permission is not available.
     * @param {string} discordUserID Discord ID of the user.
     * @returns {{[key: string]: boolean} | null} Returns object with key value pairs of user permissions or null when request fail.
     */
    async userPermissions(discordUserID){
        const payload = {
            ...this.authenticationJsonBody,
            discordid: discordUserID,
        };

        const response = await undici.request(`${APIClient.BASE_URL}/userpermissions`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const r = await response.body.json();

        if(response.statusCode == 200){
            const perms = APIClient.permissionListToDict(r["data"]["permissions"]);
            return {
                balance: perms.balance || false,
                decrement: perms.decrement || false,
                increment: perms.increment || false,
            }
        } else {
            console.error(r);
            return null;
        }
    }
}

module.exports = { APIClient }