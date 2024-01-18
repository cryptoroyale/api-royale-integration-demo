# Finding Players and Monetizing your game using Web3, Discord and Crypto Royale
One of the most challenging parts of modern game development is getting your game into the hands of players. With numerous games available on platforms like Steam, standing out is a significant challenge. Enter the world of cryptocurrency, offering a unique solution with Web3, Discord, and **cost-free** crypto API.

## Web3
**Web3** represents a shift in internet usage, focusing on decentralization. Utilizing blockchain technology (cryptocurrency and smart contracts), it aims to create an internet where users have sovereignty over their data, identity, and transactions.

The **Play2Earn** model revolutionizes gaming, allowing players to earn real money as they play. This approach resonates with Web3's principle of valuing user time and engagement. 

**Cost-Free Model:** The beauty of partnering with **Crypto Royale** is that it’s absolutely free. In fact, players may actually pay you small amounts of cryptocurrency to play your game, reminiscent of the golden age of arcades, but on the internet.

## Crypto Royale

The demo below is made possible using Crypto Royale's API. Crypto Royale complements the traditional game framework, creating an expansive ecosystem. Developed with Phaser, it offers a web-based platform where no sign-ups are needed, and players can earn ROY tokens. It serves as a central hub for third-party games using ROY for transactions, reminiscent of classic arcade or flash game sites, but enhanced with cryptocurrency to facilitate payments and encourage community growth. Third-party developers can leverage CryptoRoyale's community to attract new players to their games.

![Royale Ecosystem](https://images-ext-1.discordapp.net/external/QhmzCU92bd0URRLWudhIFFzsTR37CQRCpfdd_DNWbmI/https/i.imgur.com/jmmZykj.png?format=webp&quality=lossless&width=902&height=626)

## Demo: Monetize using Crypto. No blockchain - just Discord

### Implementation

To demonstrate how incredibly easy it is to add cryptocurrency transactions using the Royale API to a game written with the Phaser3 game framework, a sample of a simple game based on an already existing project made by github user `8ctopotamus` was prepared (you can find the original game here: https://github.com/8ctopotamus/phaser3-multiplayer).

Royale API simplifies blockchain operations, eliminating the need for developers to worry about confirmation time or complicated implementation. With an already written game that has user authentication via Discord OAuth, you only need to add a few lines of code - up to a dozen - to enable Play2Earn and Web3 functionality! See for yourself how easy it is!

```JavaScript
for(const playerSocketID in playerToDiscordID){
    if(players[playerSocketID].team == gameState.winner){
        await apiClient.increment(playerToDiscordID[playerSocketID], 0.01, 'Demo App Win');
    }
}
```

When handling the end-of-game event in the prepared demo, adding the above code snippet will pay 0.01 ROY to each player of the winning team. The function requires the Discord user ID, the amount to pay, and a description that will appear on the official Crypto Royale website within the transaction history. Although the method sounds simple, someone will probably say that all the complex logic is hidden inside the method - well, it is not the case!

```JavaScript
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
```

In the case of the demo implementation, the `increment` function is effectively an alias for transactions. This was done for simplicity because the `decrement` function that charges the user utilises the same `transaction` method underneath, only with the addition of a minus sign before the `amount` value.

And the entire code for the `transaction` function can be found below.

```JavaScript
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
```

The POST request to the Royale API is straightforward. The `nonce` value is the only thing that might catch your attention, it serves as an identifier for each transaction and should be unique among all transactions executed in the application. It is crucial to ensure that the ID is unique; otherwise, an error will occur. This mechanism prevents the execution of the same transaction twice, which could unintentionally add or subtract value from the user's wallet. The `authenticationJsonBody` only contains the `key` parameter, which is the authentication key to the Royale API.

In a demo project, a class was designed to handle the API with JSDoc usage descriptions for easy reference. The class includes additional methods for checking the balance of both user and developer wallets, as well as checking the user's permissions. This last option allows the application to be prepared properly and respond if the user does not have permissions enabled. In the demo application, if the user lacks the necessary permissions to receive transactions, they will be redirected to the main page and asked to go to their account settings and change their permissions. This safeguard was implemented as follows:

```JavaScript
const perms = await apiClient.userPermissions(req.session.authenticated.discordUser.id);

if(!perms.increment){
    res.render('index', {
        oauth_url: OAUTH_URL,
        perms_url: PERMS_URL,
        error_msg: 'Missing permission for increment. Allow it before joining a game.',
    });
}
```

Users can change their permissions for your application by going to the link that looks like this: `https://cryptoroyale.one/apps/?id=APP_ID`, where APP_ID is the first 5 characters of your API key.

https://github.com/cryptoroyale/api-royale-integration-demo/assets/112904613/0a58dea6-bffa-4bb1-a2bc-f642d82b08e5

### Business model proposals

By using `decrement` and `increment` operations, you can create games that are self-sustaining, relying on player entry fees for each game. You can implement any payment and reward operation in this way. The possibilities are limited only by your imagination.

For instance, the demo game could be expanded to include in-game ship upgrades that can be purchased. Additionally, rooms with paid games could be created, where the rewards for the winning team would be higher. Allow yourself to explore the possibilities, don't limit yourself, and have fun!


## Benefits of Partnering with Crypto Royale
*  **Funding:** Get paid directly for your games contribution to the ecosystem
*  **Monetization:** Lowest friction monetization of your game
*  **Find players:** Tap into an existing playerbase with over 8,000+ unique weekly players
*  **Community:** 70k+ members in discord and an active development community

![Withdraw to any blockchain](https://github.com/cryptoroyale/api-royale-integration-demo/assets/112904613/835cb8fb-324e-4dbd-9446-b0d9e73d60fc)

## Getting Started
*  **Explore:** Visit [Crypto Royale](https://cryptoroyale.one) to understand the platform.
*  **Define Your Goals:** Consider whether your focus is on attracting players, monetization, or receiving player feedback.
*  **Join our Discord:** Discover the Crypto Royale community on [Discord](https://discord.gg/cryptoroyale)
*  **Apply for an API key to join our ecosystem**: [Join Us](https://forms.gle/Fq35oT1iNhK1qzz18)
